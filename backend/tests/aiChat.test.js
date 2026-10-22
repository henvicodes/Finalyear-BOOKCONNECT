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

  it("rejects an empty message", async () => {
    const res = await ask(token, "   ");
    expect(res.status).toBe(400);
  });
});
