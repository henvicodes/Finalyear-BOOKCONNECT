const request = require("supertest");
const app = require("../app");
const Message = require("../models/Message");
const User = require("../models/User");
const { connectTestDB, disconnectTestDB } = require("./setup");
const { createVerifiedUser } = require("./helpers");

// These tests must never call a real AI service, whatever keys the developer has locally.
let savedKeys;
beforeAll(async () => {
  savedKeys = { c: process.env.CLAUDE_API_KEY, g: process.env.GEMINI_API_KEY };
  delete process.env.CLAUDE_API_KEY;
  delete process.env.GEMINI_API_KEY;
  await connectTestDB();
});
afterAll(async () => {
  if (savedKeys.c) process.env.CLAUDE_API_KEY = savedKeys.c;
  if (savedKeys.g) process.env.GEMINI_API_KEY = savedKeys.g;
  await disconnectTestDB();
});

const AI_BOT_ID = "0000000000000000000000aa";
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const ask = (token, content) => request(app).post("/api/messages/ai").set(auth(token)).send({ content });

describe("AI assistant chat", () => {
  let token;
  beforeAll(async () => {
    token = await createVerifiedUser({ name: "Chat Tester", email: "chat-tester@example.com", password: "password123", role: "author" });
  });

  it("answers, and marks which message the assistant wrote", async () => {
    const res = await ask(token, "hello");
    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe("hello");
    expect(res.body.aiResponse.sender._id || res.body.aiResponse.sender).toBe(AI_BOT_ID);
    expect(res.body.aiResponse.content).toMatch(/Chat Tester/);

    const stored = await Message.find({ isAi: true }).sort("createdAt");
    expect(stored.map((m) => m.fromAi)).toEqual([false, true]);
  });

  it("loads the history with the assistant's answers on the assistant's side (not the user's)", async () => {
    await ask(token, "how are you ?");
    const res = await request(app).get(`/api/messages/${AI_BOT_ID}`).set(auth(token));
    const senders = res.body.data.map((m) => (m.sender._id === AI_BOT_ID ? "assistant" : "me"));
    expect(senders).toEqual(["me", "assistant", "me", "assistant"]);
    expect(res.body.data[3].content).toMatch(/basic mode/i);
  });

  it("treats messages saved before the flag existed as question / answer pairs", async () => {
    const u = await User.findOne({ email: "chat-tester@example.com" });
    await Message.deleteMany({ isAi: true });
    for (const text of ["old question", "old answer"]) {
      await Message.collection.insertOne({ sender: u._id, receiver: u._id, content: text, isAi: true, deletedBy: [], createdAt: new Date(), updatedAt: new Date() });
    }
    const res = await request(app).get(`/api/messages/${AI_BOT_ID}`).set(auth(token));
    expect(res.body.data.map((m) => (m.sender._id === AI_BOT_ID ? "assistant" : "me"))).toEqual(["me", "assistant"]);
  });

  it("gives a relevant built-in answer instead of a generic one", async () => {
    const cases = [
      ["how do offers and fees work?", /offer/i],
      ["I forgot my PIN", /PIN/],
      ["What is MetaMask?", /MetaMask/],
      ["how do I get verified", /Verification|Verified/],
      ["thanks!", /welcome/i],
    ];
    for (const [question, expected] of cases) {
      const res = await ask(token, question);
      expect(res.body.aiResponse.content).toMatch(expected);
    }
  });

  it("does not mistake 'history' or 'this' for a greeting", async () => {
    const res = await ask(token, "tell me about the history of this");
    expect(res.body.aiResponse.content).not.toMatch(/^Hello/);
  });

  it("does not list you as a contact in your own conversation list", async () => {
    await ask(token, "hello again");
    const me = await User.findOne({ email: "chat-tester@example.com" });
    const res = await request(app).get("/api/messages/conversations").set(auth(token));
    const partners = res.body.data.map((c) => c.partner._id.toString());
    expect(partners).toEqual([AI_BOT_ID]); // only the assistant, never yourself
    expect(partners).not.toContain(me._id.toString());
    expect(res.body.data[0].lastMessage.content.length).toBeGreaterThan(0);
  });

  it("an AI chat doesn't hide a real conversation with another person", async () => {
    const other = await User.create({ name: "Real Person", email: "real-person@example.com", password: "password123", role: "reader", isEmailVerified: true });
    const me = await User.findOne({ email: "chat-tester@example.com" });
    await Message.create({ sender: other._id, receiver: me._id, content: "Hi from a person" });
    const res = await request(app).get("/api/messages/conversations").set(auth(token));
    const partners = res.body.data.map((c) => c.partner._id.toString());
    expect(partners).toEqual([AI_BOT_ID, other._id.toString()]);
    expect(res.body.data[1].unreadCount).toBe(1);
  });

  it("rejects an empty message", async () => {
    const res = await ask(token, "   ");
    expect(res.status).toBe(400);
  });
});

describe("The assistant works for every role, with answers for that role", () => {
  const pwd = "password123";
  let tokens;

  beforeAll(async () => {
    await User.create({ name: "Chat Admin", email: "chat-admin@example.com", password: pwd, role: "admin", isEmailVerified: true });
    const admin = (await request(app).post("/api/auth/login").send({ email: "chat-admin@example.com", password: pwd })).body.data.token;
    const reader = await createVerifiedUser({ name: "Chat Reader", email: "chat-reader@example.com", password: pwd, role: "reader" });
    const publisher = await createVerifiedUser({ name: "Chat Publisher", email: "chat-publisher@example.com", password: pwd, role: "publisher" });
    const author = await createVerifiedUser({ name: "Chat Author", email: "chat-author2@example.com", password: pwd, role: "author" });
    tokens = { admin, reader, publisher, author };
  });

  it("gives each role its own starter questions", async () => {
    const seen = {};
    for (const [role, t] of Object.entries(tokens)) {
      const res = await request(app).get("/api/messages/ai/starters").set(auth(t));
      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      seen[role] = res.body.data.join("|");
    }
    expect(new Set(Object.values(seen)).size).toBe(4); // all four lists differ
    expect(seen.admin).toMatch(/verify a publisher/i);
    expect(seen.reader).toMatch(/buy a paid book/i);
  });

  it("answers an admin's questions about admin tasks", async () => {
    const suspend = await ask(tokens.admin, "How do I suspend a user?");
    expect(suspend.body.aiResponse.content).toMatch(/Users/);
    expect(suspend.body.aiResponse.content).toMatch(/Reinstate/);
    const verify = await ask(tokens.admin, "How do I verify a publisher?");
    expect(verify.body.aiResponse.content).toMatch(/official register/i);
    const audit = await ask(tokens.admin, "What does the audit log record?");
    expect(audit.body.aiResponse.content).toMatch(/every admin action/i);
  });

  it("answers a reader about reading, and a publisher about their inbox", async () => {
    const rate = await ask(tokens.reader, "How do I rate a book?");
    expect(rate.body.aiResponse.content).toMatch(/stars/i);
    const library = await ask(tokens.reader, "where is my library");
    expect(library.body.aiResponse.content).toMatch(/My Library/);
    const inbox = await ask(tokens.publisher, "where do I see submissions?");
    expect(inbox.body.aiResponse.content).toMatch(/Submissions/);
  });

  it("greets each role with questions that fit them", async () => {
    const admin = await ask(tokens.admin, "hello");
    expect(admin.body.aiResponse.content).toMatch(/admin/i);
    expect(admin.body.aiResponse.content).toMatch(/verify a publisher|suspend a user/i);
    const reader = await ask(tokens.reader, "hello");
    expect(reader.body.aiResponse.content).toMatch(/reader/i);
  });

  it("is available to admins in the conversation list too, and keeps each user's chat private", async () => {
    const a = await request(app).get("/api/messages/conversations").set(auth(tokens.admin));
    expect(a.body.data[0].partner._id).toBe(AI_BOT_ID);
    const hist = await request(app).get(`/api/messages/${AI_BOT_ID}`).set(auth(tokens.reader));
    expect(hist.body.data.map((m) => m.content).join(" ")).not.toMatch(/suspend/i); // admin's questions aren't visible to the reader
  });

  it("rejects an empty message for every role", async () => {
    for (const t of Object.values(tokens)) {
      expect((await ask(t, "   ")).status).toBe(400);
    }
  });
});
