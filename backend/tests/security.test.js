const http = require("http");
const request = require("supertest");
const { io: ioClient } = require("socket.io-client");
const app = require("../app");
const User = require("../models/User");
const Book = require("../models/Book");
const Transaction = require("../models/Transaction");
const chainVerifier = require("../services/chainVerifier");
const { attachSocket } = require("../socket");
const { connectTestDB, disconnectTestDB } = require("./setup");
const { createVerifiedUser, setWalletPin, lastOtp } = require("./helpers");

beforeAll(connectTestDB);
afterAll(disconnectTestDB);

const auth = (token) => ({ Authorization: `Bearer ${token}` });
const pwd = "password123";
const HASH_A = "0x" + "a".repeat(64);
const HASH_B = "0x" + "b".repeat(64);
const WALLET_1 = "0x1111111111111111111111111111111111111111";
const WALLET_2 = "0x2222222222222222222222222222222222222222";

describe("Registration codes (OTP)", () => {
  const email = "otp-limit@example.com";

  it("locks the code after 5 wrong guesses, even if the right code comes next", async () => {
    await request(app).post("/api/auth/send-otp").send({ name: "Otp User", email, password: pwd, role: "reader" });
    const right = lastOtp(email);
    const wrong = right === "111111" ? "222222" : "111111";

    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/api/auth/verify-otp").send({ email, otp: wrong });
      expect(res.status).toBe(400);
    }
    const blocked = await request(app).post("/api/auth/verify-otp").send({ email, otp: right });
    expect(blocked.status).toBe(429);
  });

  it("a freshly requested code works again", async () => {
    await request(app).post("/api/auth/resend-otp").send({ email });
    const res = await request(app).post("/api/auth/verify-otp").send({ email, otp: lastOtp(email) });
    expect(res.status).toBe(201);
  });

  it("does not accept a Mongo operator in place of the e-mail", async () => {
    const res = await request(app).post("/api/auth/verify-otp").send({ email: { $ne: null }, otp: "123456" });
    expect([400, 404]).toContain(res.status);
  });
});

describe("Login and sign-up hardening", () => {
  it("no longer has the unverified /register shortcut", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Sneaky", email: "sneaky@example.com", password: pwd, role: "reader" });
    expect(res.status).toBe(404);
  });

  it("refuses to log in an account whose e-mail was never verified", async () => {
    await request(app)
      .post("/api/auth/send-otp")
      .send({ name: "Half Done", email: "half-done@example.com", password: pwd, role: "reader" });
    const res = await request(app).post("/api/auth/login").send({ email: "half-done@example.com", password: pwd });
    expect(res.status).toBe(403);
  });

  it("ignores Mongo operators sent as the email/password", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: { $ne: "x" }, password: { $ne: "x" } });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.data).toBeUndefined();
  });

  it("sets safe security headers", async () => {
    const res = await request(app).get("/api/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });
});

describe("Wallet PIN", () => {
  let token;
  let userId;

  beforeAll(async () => {
    token = await createVerifiedUser({ name: "Pin User", email: "pin-user@example.com", password: pwd, role: "reader" });
    userId = (await User.findOne({ email: "pin-user@example.com" }))._id;
  });

  it("is stored as a bcrypt hash, never the PIN itself", async () => {
    const res = await setWalletPin(token, "2468");
    expect(res.status).toBe(200);
    const stored = await User.findById(userId).select("+walletPin");
    expect(stored.walletPin).not.toBe("2468");
    expect(stored.walletPin).toMatch(/^\$2[aby]\$/);
  });

  it("is never returned by the profile endpoint", async () => {
    const res = await request(app).get("/api/auth/profile").set(auth(token));
    expect(JSON.stringify(res.body)).not.toMatch(/walletPin/);
  });

  it("cannot be overwritten with only a login token", async () => {
    const res = await request(app).post("/api/blockchain/set-pin").set(auth(token)).send({ pin: "9999" });
    expect(res.status).toBe(403);
    const ok = await request(app).post("/api/blockchain/verify-pin").set(auth(token)).send({ pin: "2468" });
    expect(ok.status).toBe(200);
  });

  it("can be changed with the current PIN, or reset with the account password", async () => {
    const wrongPw = await request(app)
      .post("/api/blockchain/set-pin").set(auth(token)).send({ pin: "1357", password: "not-my-password" });
    expect(wrongPw.status).toBe(401);

    const byPassword = await request(app)
      .post("/api/blockchain/set-pin").set(auth(token)).send({ pin: "1357", password: pwd });
    expect(byPassword.status).toBe(200);

    const byCurrent = await request(app)
      .post("/api/blockchain/set-pin").set(auth(token)).send({ pin: "2468", currentPin: "1357" });
    expect(byCurrent.status).toBe(200);
  });

  it("locks for 15 minutes after 5 wrong tries (even the right PIN is refused)", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app).post("/api/blockchain/verify-pin").set(auth(token)).send({ pin: "0000" });
      expect([400, 429]).toContain(res.status);
    }
    const locked = await request(app).post("/api/blockchain/verify-pin").set(auth(token)).send({ pin: "2468" });
    expect(locked.status).toBe(429);
    expect(locked.body.locked).toBe(true);
  });

  it("upgrades an old plain-text PIN to a hash the first time it is used", async () => {
    const legacyEmail = "legacy-pin@example.com";
    const legacyToken = await createVerifiedUser({ name: "Legacy", email: legacyEmail, password: pwd, role: "reader" });
    await User.collection.updateOne({ email: legacyEmail }, { $set: { walletPin: "5555" } });

    const res = await request(app).post("/api/blockchain/verify-pin").set(auth(legacyToken)).send({ pin: "5555" });
    expect(res.status).toBe(200);
    const stored = await User.findOne({ email: legacyEmail }).select("+walletPin");
    expect(stored.walletPin).toMatch(/^\$2[aby]\$/);
  });
});

describe("Money moves are atomic and validated", () => {
  let aliceToken, bobToken, aliceId, bobId, paidBookId;

  beforeAll(async () => {
    aliceToken = await createVerifiedUser({ name: "Alice", email: "alice-pay@example.com", password: pwd, role: "reader" });
    bobToken = await createVerifiedUser({ name: "Bob", email: "bob-pay@example.com", password: pwd, role: "reader" });
    await createVerifiedUser({ name: "Auth Pay", email: "author-pay@example.com", password: pwd, role: "author" });
    await setWalletPin(aliceToken, "1234");
    await setWalletPin(bobToken, "1234");
    aliceId = (await User.findOne({ email: "alice-pay@example.com" }))._id.toString();
    bobId = (await User.findOne({ email: "bob-pay@example.com" }))._id.toString();
    const author = await User.findOne({ email: "author-pay@example.com" });
    const book = await Book.create({
      title: "Race Book", description: "d", genre: "fiction", author: author._id,
      status: "published", isPaid: true, price: 600,
    });
    paidBookId = book._id.toString();
  });

  it("simultaneous purchases of the same book charge only once", async () => {
    const send = () =>
      request(app).post(`/api/reader/${paidBookId}/purchase`).set(auth(aliceToken)).send({ pin: "1234" });
    const results = await Promise.all([send(), send(), send()]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);

    const alice = await User.findById(aliceId);
    expect(alice.walletBalance).toBe(400);
    expect(alice.purchasedBooks).toHaveLength(1);
    const author = await User.findOne({ email: "author-pay@example.com" });
    expect(author.walletBalance).toBe(1600);
  });

  it("refuses a paid purchase without or with a wrong PIN", async () => {
    const book = await Book.create({
      title: "Pin Book", description: "d", genre: "fiction",
      author: (await User.findOne({ email: "author-pay@example.com" }))._id,
      status: "published", isPaid: true, price: 10,
    });
    const none = await request(app).post(`/api/reader/${book._id}/purchase`).set(auth(bobToken)).send({});
    expect(none.status).toBe(400);
    const bad = await request(app).post(`/api/reader/${book._id}/purchase`).set(auth(bobToken)).send({ pin: "9999" });
    expect(bad.status).toBe(400);
    expect((await User.findById(bobId)).walletBalance).toBe(1000);
  });

  it("parallel transfers can't spend more than the balance", async () => {
    // Bob has 1000; five parallel transfers of 400 -> at most two can succeed.
    const send = () =>
      request(app).post("/api/blockchain/transfer").set(auth(bobToken))
        .send({ receiverId: aliceId, amount: 400, pin: "1234" });
    const results = await Promise.all([send(), send(), send(), send(), send()]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(2);
    expect((await User.findById(bobId)).walletBalance).toBe(200);
  });

  it("rejects negative, zero, string, null and huge amounts, and paying yourself", async () => {
    for (const amount of [-5, 0, "abc", null, 1e12]) {
      const res = await request(app).post("/api/blockchain/transfer").set(auth(bobToken))
        .send({ receiverId: aliceId, amount, pin: "1234" });
      expect(res.status).toBe(400);
    }
    const self = await request(app).post("/api/blockchain/transfer").set(auth(bobToken))
      .send({ receiverId: bobId, amount: 1, pin: "1234" });
    expect(self.status).toBe(400);
  });

  it("requires the PIN for every transfer", async () => {
    const res = await request(app).post("/api/blockchain/transfer").set(auth(bobToken))
      .send({ receiverId: aliceId, amount: 1 });
    expect(res.status).toBe(400);
  });
});

describe("On-chain proof is verified, not trusted", () => {
  let payerToken, payerId, authorId, bookId;

  beforeAll(async () => {
    payerToken = await createVerifiedUser({ name: "Chain Reader", email: "chain-reader@example.com", password: pwd, role: "reader" });
    await createVerifiedUser({ name: "Chain Author", email: "chain-author@example.com", password: pwd, role: "author" });
    await setWalletPin(payerToken, "1234");
    const payer = await User.findOneAndUpdate({ email: "chain-reader@example.com" }, { walletAddress: WALLET_1 }, { new: true });
    const author = await User.findOneAndUpdate({ email: "chain-author@example.com" }, { walletAddress: WALLET_2 }, { new: true });
    payerId = payer._id.toString();
    authorId = author._id.toString();
    bookId = (await Book.create({
      title: "Chain Book 1", description: "d", genre: "fiction", author: author._id,
      status: "published", isPaid: true, price: 5,
    }))._id.toString();
  });

  // Only the chain-verifier spies are undone after each test; restoring
  // *all* mocks would also remove the e-mail interception from helpers.js.
  const chainSpies = [];
  const mockChain = (fn, result) => {
    const spy = jest.spyOn(chainVerifier, fn).mockResolvedValue(result);
    chainSpies.push(spy);
    return spy;
  };
  afterEach(() => {
    while (chainSpies.length) chainSpies.pop().mockRestore();
  });

  it("marks a purchase on-chain only when the verifier confirms it", async () => {
    // The verifier is replaced here; it is the only thing that touches the RPC.
    const spy = mockChain("verifyPayment", { verified: true });
    const res = await request(app).post(`/api/reader/${bookId}/purchase`).set(auth(payerToken)).send({ pin: "1234", txHash: HASH_A });
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledWith({ txHash: HASH_A, senderAddress: WALLET_1, receiverAddress: WALLET_2 });
    const tx = await Transaction.findOne({ txHash: HASH_A });
    expect(tx.onChain).toBe(true);
    expect(tx.network).toBe("sepolia");
  });

  it("keeps the payment off-chain (with a warning) when the hash doesn't check out", async () => {
    mockChain("verifyPayment", { verified: false, reason: "Transaction not found" });
    const book = await Book.create({
      title: "Chain Book 2", description: "d", genre: "fiction", author: authorId,
      status: "published", isPaid: true, price: 5,
    });
    const res = await request(app).post(`/api/reader/${book._id}/purchase`).set(auth(payerToken)).send({ pin: "1234", txHash: HASH_B });
    expect(res.status).toBe(200);
    expect(res.body.chainWarning).toMatch(/not accepted/i);
    expect(await Transaction.findOne({ txHash: HASH_B })).toBeNull();
    const tx = await Transaction.findOne({ sender: payerId, note: /Chain Book 2/ });
    expect(tx.onChain).toBe(false);
  });

  it("refuses a transfer that re-uses a hash already recorded", async () => {
    mockChain("verifyPayment", { verified: true });
    const res = await request(app).post("/api/blockchain/transfer").set(auth(payerToken))
      .send({ receiverId: authorId, amount: 1, pin: "1234", txHash: HASH_A });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/already used/i);
  });

  it("does not record a manuscript registration the chain can't confirm", async () => {
    const login = await request(app).post("/api/auth/login").send({ email: "chain-author@example.com", password: pwd });
    const authorToken = login.body.data.token;
    const mine = await Book.create({ title: "Reg Book", description: "d", genre: "fiction", author: authorId, status: "draft" });

    mockChain("verifyRegistration", { verified: false, reason: "not found" });
    const bad = await request(app).post(`/api/blockchain/onchain-register/${mine._id}`).set(auth(authorToken)).send({ txHash: HASH_B });
    expect(bad.status).toBe(422);
    expect((await Book.findById(mine._id)).onChainTxHash).toBeUndefined();

    chainSpies.pop().mockRestore();
    mockChain("verifyRegistration", { verified: true });
    const good = await request(app).post(`/api/blockchain/onchain-register/${mine._id}`).set(auth(authorToken)).send({ txHash: HASH_B });
    expect(good.status).toBe(200);

    const other = await Book.create({ title: "Reg Book 2", description: "d", genre: "fiction", author: authorId, status: "draft" });
    const reuse = await request(app).post(`/api/blockchain/onchain-register/${other._id}`).set(auth(authorToken)).send({ txHash: HASH_B });
    expect(reuse.status).toBe(409);
  });

  it("only lets someone with a linked wallet register on-chain", async () => {
    const token = await createVerifiedUser({ name: "No Wallet", email: "no-wallet@example.com", password: pwd, role: "author" });
    const me = await User.findOne({ email: "no-wallet@example.com" });
    const b = await Book.create({ title: "NW", description: "d", genre: "fiction", author: me._id, status: "draft" });
    const res = await request(app).post(`/api/blockchain/onchain-register/${b._id}`).set(auth(token)).send({ txHash: HASH_A });
    expect(res.status).toBe(400);
  });
});

describe("Ownership checks", () => {
  let authorToken, otherToken, readerToken, bookId, paidId;

  beforeAll(async () => {
    authorToken = await createVerifiedUser({ name: "Own Author", email: "own-author@example.com", password: pwd, role: "author" });
    otherToken = await createVerifiedUser({ name: "Other Author", email: "other-author@example.com", password: pwd, role: "author" });
    readerToken = await createVerifiedUser({ name: "Own Reader", email: "own-reader@example.com", password: pwd, role: "reader" });
    const author = await User.findOne({ email: "own-author@example.com" });
    const mk = (extra) => Book.create({
      title: "T", description: "d", content: "Some manuscript text. ".repeat(20),
      genre: "fiction", author: author._id, status: "published", ...extra,
    });
    bookId = (await mk({ title: "Free One" }))._id.toString();
    paidId = (await mk({ title: "Paid One", isPaid: true, price: 50 }))._id.toString();
  });

  it("only the author (or assigned publisher) can run an evaluation that writes scores", async () => {
    const stranger = await request(app).post(`/api/ai/evaluate/${bookId}`).set(auth(otherToken)).send({});
    expect(stranger.status).toBe(403);
    const reader = await request(app).post(`/api/ai/evaluate/${bookId}`).set(auth(readerToken)).send({});
    expect(reader.status).toBe(403);
    const owner = await request(app).post(`/api/ai/evaluate/${bookId}`).set(auth(authorToken)).send({});
    expect(owner.status).toBe(200);
  });

  it("authors can't rate their own book", async () => {
    const res = await request(app).post(`/api/books/${bookId}/rate`).set(auth(authorToken)).send({ rating: 5 });
    expect(res.status).toBe(403);
  });

  it("paid books can only be rated by buyers; free ones by any logged-in user", async () => {
    const paid = await request(app).post(`/api/books/${paidId}/rate`).set(auth(readerToken)).send({ rating: 5 });
    expect(paid.status).toBe(403);
    const free = await request(app).post(`/api/books/${bookId}/rate`).set(auth(readerToken)).send({ rating: 4 });
    expect(free.status).toBe(200);
  });

  it("rejects ratings that aren't numbers between 1 and 5", async () => {
    for (const rating of [0, 6, "abc", null]) {
      const res = await request(app).post(`/api/books/${bookId}/rate`).set(auth(readerToken)).send({ rating });
      expect(res.status).toBe(400);
    }
  });

  it("rejects a malformed wallet address", async () => {
    const res = await request(app).post("/api/auth/link-wallet").set(auth(readerToken)).send({ walletAddress: "not-an-address" });
    expect(res.status).toBe(400);
  });
});

describe("Cookie sessions (browser login)", () => {
  const email = "cookie-user@example.com";
  const sessionCookie = (res) =>
    (res.headers["set-cookie"] || []).find((c) => c.startsWith("bc_session="));

  beforeAll(async () => {
    await createVerifiedUser({ name: "Cookie User", email, password: pwd, role: "reader" });
  });

  it("login sets an httpOnly, SameSite session cookie", async () => {
    const res = await request(app).post("/api/auth/login").send({ email, password: pwd });
    const cookie = sessionCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("the cookie alone authenticates reads", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email, password: pwd });
    const res = await agent.get("/api/auth/profile");
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(email);
  });

  it("a cookie-authenticated change is refused without the app's request header (CSRF)", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email, password: pwd });

    const blocked = await agent.put("/api/auth/profile").send({ bio: "hacked" });
    expect(blocked.status).toBe(403);

    const allowed = await agent.put("/api/auth/profile").set("X-Requested-With", "BookConnect").send({ bio: "fine" });
    expect(allowed.status).toBe(200);
  });

  it("logout clears the cookie, after which the session no longer works", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/login").send({ email, password: pwd });
    const out = await agent.post("/api/auth/logout").set("X-Requested-With", "BookConnect");
    expect(out.status).toBe(200);
    const res = await agent.get("/api/auth/profile");
    expect(res.status).toBe(401);
  });

  it("an explicit Bearer token (API clients) still works without the CSRF header", async () => {
    const login = await request(app).post("/api/auth/login").send({ email, password: pwd });
    const res = await request(app)
      .put("/api/auth/profile")
      .set(auth(login.body.data.token))
      .send({ bio: "via bearer" });
    expect(res.status).toBe(200);
  });
});

describe("Socket.io authentication", () => {
  let server, io, port, tokenA, idA, idB;

  beforeAll(async () => {
    tokenA = await createVerifiedUser({ name: "Sock A", email: "sock-a@example.com", password: pwd, role: "reader" });
    await createVerifiedUser({ name: "Sock B", email: "sock-b@example.com", password: pwd, role: "reader" });
    idA = (await User.findOne({ email: "sock-a@example.com" }))._id.toString();
    idB = (await User.findOne({ email: "sock-b@example.com" }))._id.toString();
    server = http.createServer(app);
    io = attachSocket(server);
    await new Promise((resolve) => server.listen(0, resolve));
    port = server.address().port;
  });

  afterAll(async () => {
    io.close();
    await new Promise((resolve) => server.close(resolve));
  });

  const connect = (authPayload) =>
    new Promise((resolve) => {
      const socket = ioClient(`http://localhost:${port}`, {
        auth: authPayload,
        reconnection: false,
        transports: ["websocket"],
      });
      socket.on("connect", () => resolve({ socket, ok: true }));
      socket.on("connect_error", (err) => {
        socket.close();
        resolve({ ok: false, err });
      });
    });

  it("refuses a connection with no token or a bad token", async () => {
    expect((await connect({})).ok).toBe(false);
    expect((await connect({ token: "garbage" })).ok).toBe(false);
  });

  it("puts a verified user in their own room only - claiming someone else's id does nothing", async () => {
    const { socket, ok } = await connect({ token: tokenA });
    expect(ok).toBe(true);

    const got = [];
    socket.on("private", (msg) => got.push(msg));
    socket.emit("join_room", idB); // the old, trusting event: must not add A to B's room
    await new Promise((r) => setTimeout(r, 150));

    io.to(idB).emit("private", "for-B");
    io.to(idA).emit("private", "for-A");
    await new Promise((r) => setTimeout(r, 150));

    expect(got).toEqual(["for-A"]);
    socket.close();
  });
});
