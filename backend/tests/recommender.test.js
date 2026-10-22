const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Book = require("../models/Book");
const { buildItemCF } = require("../utils/itemCF");
const { connectTestDB, disconnectTestDB } = require("./setup");
const { createVerifiedUser } = require("./helpers");

beforeAll(connectTestDB);
afterAll(disconnectTestDB);

describe("Item-based collaborative filtering (utils/itemCF.js)", () => {
  // Two taste groups: fantasy fans love F1/F2/F3 and dislike S1; sci-fi fans the reverse.
  const data = [
    ...["u1", "u2", "u3"].flatMap((u) => [
      { user: u, item: "F1", rating: 5 }, { user: u, item: "F2", rating: 5 }, { user: u, item: "S1", rating: 1 },
    ]),
    ...["u4", "u5"].flatMap((u) => [
      { user: u, item: "S1", rating: 5 }, { user: u, item: "S2", rating: 5 }, { user: u, item: "F1", rating: 1 },
    ]),
    { user: "newFan", item: "F1", rating: 5 }, { user: "newFan", item: "S1", rating: 2 },
    // u1 has also loved F3, so F3 should travel to people who like F1/F2
    { user: "u1", item: "F3", rating: 5 }, { user: "u2", item: "F3", rating: 5 },
  ];
  const cf = buildItemCF(data);

  it("sees enough overlap to be useful", () => {
    expect(cf.hasSignal).toBe(true);
    expect(cf.stats.users).toBe(6);
  });

  it("recommends the book that like-minded readers loved, and not the other camp's", () => {
    const recs = cf.recommend("newFan", ["F2", "F3", "S2"]);
    const order = recs.map((r) => r.item);
    expect(order[0]).toBe("F2");
    expect(order).toContain("F3");
    expect(order).not.toContain("S2");
  });

  it("explains a recommendation by the book the reader already has", () => {
    const [top] = cf.recommend("newFan", ["F2"]);
    expect(top.because).toBe("F1");
  });

  it("never recommends something the reader already has, and has nothing for strangers", () => {
    expect(cf.recommend("newFan", ["F1", "S1"]).map((r) => r.item)).toEqual([]);
    expect(cf.recommend("nobody", ["F2"])).toEqual([]);
  });

  it("reports no signal when readers don't overlap", () => {
    const sparse = buildItemCF([{ user: "a", item: "x", rating: 5 }, { user: "b", item: "y", rating: 4 }]);
    expect(sparse.hasSignal).toBe(false);
  });
});

describe("GET /api/recommendations (hybrid)", () => {
  const pwd = "password123";
  let token;

  beforeAll(async () => {
    const author = await createVerifiedUser({ name: "Rec Author", email: "rec-author@example.com", password: pwd, role: "author" });
    expect(author).toBeTruthy();
    const authorUser = await User.findOne({ email: "rec-author@example.com" });
    const mk = (title, description, genre) =>
      Book.create({ title, description, genre, author: authorUser._id, status: "published" });

    const [f1, f2, s1, s2] = await Promise.all([
      mk("Dragon Keep", "A wizard and a dragon fight a dark king in a magic kingdom", "fiction"),
      mk("Elf Crown", "An elf queen and her sword battle a dark sorcerer", "fiction"),
      mk("Star Drift", "A starship crew crosses space to a distant planet", "science"),
      mk("Mars Lab", "Scientists build a laboratory colony on Mars", "science"),
    ]);

    // Four other readers establish two taste groups through ratings.
    const rate = async (email, pairs) => {
      await createVerifiedUser({ name: email.split("@")[0], email, password: pwd, role: "reader" });
      const u = await User.findOne({ email });
      for (const [book, rating] of pairs) {
        await Book.updateOne({ _id: book._id }, { $push: { ratings: { user: u._id, rating } } });
      }
    };
    await rate("fan1@example.com", [[f1, 5], [f2, 5], [s1, 1]]);
    await rate("fan2@example.com", [[f1, 5], [f2, 4], [s2, 1]]);
    await rate("sf1@example.com", [[s1, 5], [s2, 5], [f1, 1]]);
    await rate("sf2@example.com", [[s1, 5], [s2, 4], [f2, 1]]);

    // The reader we ask for has only rated one fantasy book.
    token = await createVerifiedUser({ name: "Target Reader", email: "target-reader@example.com", password: pwd, role: "reader" });
    const target = await User.findOne({ email: "target-reader@example.com" });
    await Book.updateOne({ _id: f1._id }, { $push: { ratings: { user: target._id, rating: 5 } } });
  });

  it("returns personalised results using collaborative filtering, led by the fantasy book", async () => {
    const res = await request(app).get("/api/recommendations").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.personalized).toBe(true);
    expect(res.body.collaborative).toBe(true);
    expect(res.body.data[0].book.title).toBe("Elf Crown");
    expect(res.body.data[0].reason).toMatch(/Readers who liked "Dragon Keep" also liked this/);
  });
});
