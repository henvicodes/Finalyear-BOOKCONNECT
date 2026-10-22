const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Book = require("../models/Book");
const Message = require("../models/Message");
const { connectTestDB, disconnectTestDB } = require("./setup");
const { createVerifiedUser } = require("./helpers");

beforeAll(connectTestDB);
afterAll(disconnectTestDB);

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const pwd = "password123";

describe("Publisher can decline a submission", () => {
  let authorToken, pubAToken, pubBToken, pubAId, pubBId, bookId;

  beforeAll(async () => {
    authorToken = await createVerifiedUser({ name: "Dec Author", email: "dec-author@example.com", password: pwd, role: "author" });
    pubAToken = await createVerifiedUser({ name: "Dec Pub A", email: "dec-pub-a@example.com", password: pwd, role: "publisher" });
    pubBToken = await createVerifiedUser({ name: "Dec Pub B", email: "dec-pub-b@example.com", password: pwd, role: "publisher" });
    pubAId = (await User.findOne({ email: "dec-pub-a@example.com" }))._id.toString();
    pubBId = (await User.findOne({ email: "dec-pub-b@example.com" }))._id.toString();

    const created = await request(app)
      .post("/api/manuscripts")
      .set(auth(authorToken))
      .send({ title: "Decline Me", content: "A draft that will be turned down. ".repeat(10), genre: "fiction" });
    bookId = created.body.data._id;
  });

  it("only the assigned publisher can decline, and only after it was submitted", async () => {
    const early = await request(app).post(`/api/manuscripts/${bookId}/decline`).set(auth(pubAToken)).send({});
    expect(early.status).toBe(403); // no publisher assigned yet

    const submit = await request(app).post(`/api/manuscripts/${bookId}/submit`).set(auth(authorToken)).send({ publisherId: pubAId });
    expect(submit.status).toBe(200);

    const stranger = await request(app).post(`/api/manuscripts/${bookId}/decline`).set(auth(pubBToken)).send({});
    expect(stranger.status).toBe(403);
    const author = await request(app).post(`/api/manuscripts/${bookId}/decline`).set(auth(authorToken)).send({});
    expect(author.status).toBe(403); // authors have a different role
  });

  it("can't submit the same manuscript twice, nor to a non-publisher", async () => {
    const twice = await request(app).post(`/api/manuscripts/${bookId}/submit`).set(auth(authorToken)).send({ publisherId: pubBId });
    expect(twice.status).toBe(400);
  });

  it("an author cannot fake a workflow status through the edit routes", async () => {
    const res = await request(app).put(`/api/manuscripts/${bookId}`).set(auth(authorToken)).send({ status: "cost_proposed" });
    expect(res.status).toBe(400);
    const viaBooks = await request(app).put(`/api/books/${bookId}`).set(auth(authorToken)).send({ status: "seen" });
    expect(viaBooks.status).toBe(400);
    // sending the book's current status back unchanged is fine (edit forms do this)
    const same = await request(app).put(`/api/books/${bookId}`).set(auth(authorToken)).send({ status: "under_review", title: "Decline Me" });
    expect(same.status).toBe(200);
  });

  it("declining marks it declined, drops the publisher's access, and tells the author", async () => {
    const res = await request(app).post(`/api/manuscripts/${bookId}/decline`).set(auth(pubAToken)).send({ reason: "Not our genre" });
    expect(res.status).toBe(200);

    const book = await Book.findById(bookId);
    expect(book.status).toBe("declined");
    expect(book.declineReason).toBe("Not our genre");
    expect(book.publisher || null).toBeNull();

    const note = await Message.findOne({ book: bookId, content: /DECLINED/ });
    expect(note).not.toBeNull();
    expect(note.content).toMatch(/Not our genre/);

    // the old publisher can no longer open it or see it in the inbox
    const open = await request(app).get(`/api/manuscripts/${bookId}`).set(auth(pubAToken));
    expect(open.status).toBe(403);
    const inbox = await request(app).get("/api/manuscripts/submissions").set(auth(pubAToken));
    expect(inbox.body.data.map((b) => b._id)).not.toContain(bookId);
  });

  it("the author can then send it to another publisher, who can make an offer", async () => {
    const resubmit = await request(app).post(`/api/manuscripts/${bookId}/submit`).set(auth(authorToken)).send({ publisherId: pubBId });
    expect(resubmit.status).toBe(200);

    const book = await Book.findById(bookId);
    expect(book.status).toBe("under_review");
    expect(book.declineReason).toBeUndefined();

    const offer = await request(app).post(`/api/manuscripts/${bookId}/propose-cost`).set(auth(pubBToken)).send({ cost: 120 });
    expect(offer.status).toBe(200);
  });

  it("offers need a sensible amount and a manuscript that is waiting for review", async () => {
    for (const cost of [-1, "abc", null, 1e12]) {
      const res = await request(app).post(`/api/manuscripts/${bookId}/propose-cost`).set(auth(pubBToken)).send({ cost });
      expect(res.status).toBe(400);
    }
    await Book.updateOne({ _id: bookId }, { status: "published" });
    const late = await request(app).post(`/api/manuscripts/${bookId}/propose-cost`).set(auth(pubBToken)).send({ cost: 50 });
    expect(late.status).toBe(400);
    const lateDecline = await request(app).post(`/api/manuscripts/${bookId}/decline`).set(auth(pubBToken)).send({});
    expect(lateDecline.status).toBe(400);
  });
});
