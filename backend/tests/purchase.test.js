const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const { connectTestDB, disconnectTestDB } = require("./setup");

beforeAll(connectTestDB);
afterAll(disconnectTestDB);

async function createVerifiedUser({ name, email, password, role }) {
  await request(app).post("/api/auth/send-otp").send({ name, email, password, role });
  const stored = await User.findOne({ email }).select("+otpCode");
  const verify = await request(app).post("/api/auth/verify-otp").send({ email, otp: stored.otpCode });
  return verify.body.data.token;
}

describe("Reader purchase flow", () => {
  let authorToken;
  let readerToken;
  let paidBookId;
  let freeBookId;

  beforeAll(async () => {
    authorToken = await createVerifiedUser({
      name: "Purchase Test Author",
      email: "purchase-test-author@example.com",
      password: "password123",
      role: "author",
    });
    readerToken = await createVerifiedUser({
      name: "Purchase Test Reader",
      email: "purchase-test-reader@example.com",
      password: "password123",
      role: "reader",
    });

    // Directly create + publish two books via the model, to test the
    // purchase route in isolation from the full submission workflow
    // (already covered by publishing.test.js).
    const Book = require("../models/Book");
    const author = await User.findOne({ email: "purchase-test-author@example.com" });

    const paidBook = await Book.create({
      title: "Paid Test Book",
      description: "A book that costs money.",
      genre: "fiction",
      author: author._id,
      status: "published",
      isPaid: true,
      price: 200,
    });
    paidBookId = paidBook._id.toString();

    const freeBook = await Book.create({
      title: "Free Test Book",
      description: "A book that costs nothing.",
      genre: "fiction",
      author: author._id,
      status: "published",
      isPaid: false,
      price: 0,
    });
    freeBookId = freeBook._id.toString();
  });

  it("rejects a purchase attempt by a non-reader (author-only content, publisher/author excluded)", async () => {
    const res = await request(app)
      .post(`/api/reader/${paidBookId}/purchase`)
      .set("Authorization", `Bearer ${authorToken}`)
      .send({});

    expect(res.status).toBe(403);
  });

  it("lets a reader purchase a paid book and deducts the price from their wallet", async () => {
    const res = await request(app)
      .post(`/api/reader/${paidBookId}/purchase`)
      .set("Authorization", `Bearer ${readerToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.walletBalance).toBe(800); // 1000 default - 200 price
    expect(res.body.purchasedBooks.map(String)).toContain(paidBookId);
  });

  it("credits the author's earnings and wallet with the purchase price", async () => {
    const authorProfile = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", `Bearer ${authorToken}`);

    expect(authorProfile.body.data.earnings).toBe(200);
    expect(authorProfile.body.data.walletBalance).toBe(1200); // 1000 default + 200 earned
  });

  it("rejects purchasing the same book twice", async () => {
    const res = await request(app)
      .post(`/api/reader/${paidBookId}/purchase`)
      .set("Authorization", `Bearer ${readerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already purchased/i);
  });

  it("lets a reader claim a free book without spending wallet balance", async () => {
    const before = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", `Bearer ${readerToken}`);

    const res = await request(app)
      .post(`/api/reader/${freeBookId}/purchase`)
      .set("Authorization", `Bearer ${readerToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.walletBalance).toBe(before.body.data.walletBalance); // unchanged
    expect(res.body.purchasedBooks.map(String)).toContain(freeBookId);
  });

  it("shows both purchased books in the reader's library", async () => {
    const res = await request(app)
      .get("/api/reader/user/library")
      .set("Authorization", `Bearer ${readerToken}`);

    expect(res.status).toBe(200);
    const ids = res.body.data.map((b) => b._id.toString());
    expect(ids).toEqual(expect.arrayContaining([paidBookId, freeBookId]));
  });

  it("rejects a purchase when the reader's wallet balance is insufficient", async () => {
    const Book = require("../models/Book");
    const author = await User.findOne({ email: "purchase-test-author@example.com" });
    const expensiveBook = await Book.create({
      title: "Very Expensive Test Book",
      description: "More than a reader's default balance.",
      genre: "fiction",
      author: author._id,
      status: "published",
      isPaid: true,
      price: 999999,
    });

    const res = await request(app)
      .post(`/api/reader/${expensiveBook._id}/purchase`)
      .set("Authorization", `Bearer ${readerToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/insufficient/i);
  });
});
