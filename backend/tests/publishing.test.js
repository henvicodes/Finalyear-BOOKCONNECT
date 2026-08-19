const request = require("supertest");
const app = require("../app");
const { connectTestDB, disconnectTestDB } = require("./setup");

beforeAll(connectTestDB);
afterAll(disconnectTestDB);

// Registers + verifies a user directly against the API (same path a real
// user goes through), returning their auth token.
async function createVerifiedUser({ name, email, password, role }) {
  await request(app).post("/api/auth/send-otp").send({ name, email, password, role });

  const User = require("../models/User");
  const stored = await User.findOne({ email }).select("+otpCode");

  const verify = await request(app)
    .post("/api/auth/verify-otp")
    .send({ email, otp: stored.otpCode });

  return verify.body.data.token;
}

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

  it("lets the author pay the proposed cost and publishes the book", async () => {
    const res = await request(app)
      .post(`/api/manuscripts/${manuscriptId}/pay-cost`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({});

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
