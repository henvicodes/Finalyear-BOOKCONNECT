const request = require("supertest");
const app = require("../app");
const { connectTestDB, disconnectTestDB } = require("./setup");
const { createVerifiedUser, setWalletPin } = require("./helpers");

beforeAll(connectTestDB);
afterAll(disconnectTestDB);


describe("Publishing workflow: author writes -> submits -> publisher prices -> author pays -> published", () => {
  let authorToken;
  let publisherToken;
  let publisherId;
  let manuscriptId;

  beforeAll(async () => {
    authorToken = await createVerifiedUser({
      name: "Test Author",
      email: "test-author@example.com",
      password: "password123",
      role: "author",
    });
    publisherToken = await createVerifiedUser({
      name: "Test Publisher",
      email: "test-publisher@example.com",
      password: "password123",
      role: "publisher",
    });

    const User = require("../models/User");
    const publisher = await User.findOne({ email: "test-publisher@example.com" });
    publisherId = publisher._id.toString();
  });

  it("lets an author create a manuscript as a draft", async () => {
    const res = await request(app)
      .post("/api/manuscripts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ title: "The Test Manuscript", content: "Once upon a time, in a test suite far away...", genre: "fiction" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("draft");
    expect(res.body.data.versionHistory.length).toBe(1);
    manuscriptId = res.body.id;
  });

  it("rejects a reader/publisher trying to create a manuscript (author-only route)", async () => {
    const res = await request(app)
      .post("/api/manuscripts")
      .set("Authorization", `Bearer ${publisherToken}`)
      .send({ title: "Not allowed", content: "Should not be created" });

    expect(res.status).toBe(403);
  });

  it("submits the manuscript to the publisher", async () => {
    const res = await request(app)
      .post(`/api/manuscripts/${manuscriptId}/submit`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ publisherId });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("under_review");
  });

  it("shows the submission in the publisher's inbox, as a summary without the draft text", async () => {
    const res = await request(app)
      .get("/api/manuscripts/submissions")
      .set("Authorization", `Bearer ${publisherToken}`);

    expect(res.status).toBe(200);
    const sub = res.body.data.find((m) => m._id === manuscriptId);
    expect(sub).toBeDefined();
    expect(sub.title).toBe("The Test Manuscript");
    expect(sub.author.name).toBe("Test Author");
    expect(sub.content).toBeUndefined();
  });

  it("lets the publisher it was sent to open and read the full draft", async () => {
    const res = await request(app)
      .get(`/api/manuscripts/${manuscriptId}`)
      .set("Authorization", `Bearer ${publisherToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe("Once upon a time, in a test suite far away...");
  });

  it("does not let a different publisher read the draft or see it in their inbox", async () => {
    const otherToken = await createVerifiedUser({
      name: "Other Publisher",
      email: "other-publisher@example.com",
      password: "password123",
      role: "publisher",
    });

    const read = await request(app)
      .get(`/api/manuscripts/${manuscriptId}`)
      .set("Authorization", `Bearer ${otherToken}`);
    expect(read.status).toBe(403);

    const inbox = await request(app)
      .get("/api/manuscripts/submissions")
      .set("Authorization", `Bearer ${otherToken}`);
    expect(inbox.body.data.find((m) => m._id === manuscriptId)).toBeUndefined();
  });

  it("keeps drafts out of the public book list, even if someone asks for them by status", async () => {
    const res = await request(app).get("/api/books?status=under_review");
    expect(res.status).toBe(200);
    expect(res.body.data.find((b) => b._id === manuscriptId)).toBeUndefined();
  });

  it("blocks a different author from proposing a cost on someone else's manuscript", async () => {
    const res = await request(app)
      .post(`/api/manuscripts/${manuscriptId}/propose-cost`)
      .set("Authorization", `Bearer ${authorToken}`) // author token, not publisher — wrong role entirely
      .send({ cost: 100 });

    expect(res.status).toBe(403);
  });

  it("lets the assigned publisher propose a publishing cost", async () => {
    const res = await request(app)
      .post(`/api/manuscripts/${manuscriptId}/propose-cost`)
      .set("Authorization", `Bearer ${publisherToken}`)
      .send({ cost: 100 });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("cost_proposed");
    expect(res.body.data.publishingCost).toBe(100);
  });

  it("records a new version snapshot when the author revises the content", async () => {
    const res = await request(app)
      .put(`/api/manuscripts/${manuscriptId}`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ content: "Once upon a time, in a test suite far away... (revised with a plot twist)" });

    expect(res.status).toBe(200);
    expect(res.body.data.versionHistory.length).toBe(2);
    expect(res.body.data.versionHistory[1].note).toBe("Edited");
    expect(res.body.data.versionHistory[1].contentHash).not.toBe(res.body.data.versionHistory[0].contentHash);
  });

  it("refuses to take the fee without the wallet PIN", async () => {
    await setWalletPin(authorToken, "4321");
    const res = await request(app)
      .post(`/api/manuscripts/${manuscriptId}/pay-cost`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ pin: "0000" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/incorrect pin/i);
  });

  it("lets the author pay the proposed cost and publishes the book", async () => {
    const res = await request(app)
      .post(`/api/manuscripts/${manuscriptId}/pay-cost`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ pin: "4321" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("published");
    expect(res.body.data.isPublishingPaid).toBe(true);
    expect(res.body.data.chapters.length).toBeGreaterThan(0);
    // Publishing auto-generates an "Introduction" chapter from the
    // manuscript content when none exist yet — that's genuinely new
    // content (chapters are hashed too), so a 3rd snapshot is correct,
    // not a dedup failure.
    expect(res.body.data.versionHistory.length).toBe(3);
    expect(res.body.data.versionHistory[2].note).toBe("Published");
  });

  it("deducts the publishing cost from the author's wallet and credits the publisher", async () => {
    const authorProfile = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", `Bearer ${authorToken}`);
    const publisherProfile = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", `Bearer ${publisherToken}`);

    expect(authorProfile.body.data.walletBalance).toBe(900); // 1000 default - 100 cost
    expect(publisherProfile.body.data.earnings).toBe(100);
  });

  it("shows the published book in the public books listing", async () => {
    const res = await request(app).get("/api/books").query({ search: "Test Manuscript" });

    expect(res.status).toBe(200);
    expect(res.body.data.some((b) => b._id === manuscriptId)).toBe(true);
  });
});


describe("Unpublished manuscripts are private (chapter text)", () => {
  let authorToken, publisherToken, otherToken, bookId, chapterId;

  beforeAll(async () => {
    authorToken = await createVerifiedUser({ name: "Private Author", email: "private-author@example.com", password: "password123", role: "author" });
    publisherToken = await createVerifiedUser({ name: "Private Publisher", email: "private-publisher@example.com", password: "password123", role: "publisher" });
    otherToken = await createVerifiedUser({ name: "Nosy Reader", email: "nosy-reader@example.com", password: "password123", role: "reader" });

    const User = require("../models/User");
    const publisher = await User.findOne({ email: "private-publisher@example.com" });

    const created = await request(app)
      .post("/api/manuscripts")
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ title: "Secret Draft", content: "Top secret opening.", genre: "fiction" });
    bookId = created.body.id;

    const chapter = await request(app)
      .post(`/api/books/${bookId}/chapters`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ title: "Chapter One", content: "The secret first chapter text." });
    chapterId = chapter.body.data._id;

    await request(app)
      .post(`/api/manuscripts/${bookId}/submit`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({ publisherId: publisher._id.toString() });
  });

  const readChapter = (token) => {
    const r = request(app).get(`/api/books/${bookId}/chapters/${chapterId}`);
    return token ? r.set("Authorization", `Bearer ${token}`) : r;
  };

  it("hides the chapter from anonymous visitors and unrelated users", async () => {
    expect((await readChapter()).status).toBe(404);
    expect((await readChapter(otherToken)).status).toBe(404);
  });

  it("lets the author and the assigned publisher read it", async () => {
    const asAuthor = await readChapter(authorToken);
    expect(asAuthor.status).toBe(200);
    expect(asAuthor.body.data.chapter.content).toBe("The secret first chapter text.");

    const asPublisher = await readChapter(publisherToken);
    expect(asPublisher.status).toBe(200);
  });

  it("lets the publisher open the full draft including chapters", async () => {
    const res = await request(app)
      .get(`/api/manuscripts/${bookId}`)
      .set("Authorization", `Bearer ${publisherToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.chapters[0].content).toBe("The secret first chapter text.");
  });
});
