const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const Book = require("../models/Book");
const Transaction = require("../models/Transaction");
const AuditLog = require("../models/AuditLog");
const { isValidGstin, isValidIsbn13, normaliseRegistration } = require("../utils/registration");
const { connectTestDB, disconnectTestDB } = require("./setup");
const { createVerifiedUser } = require("./helpers");

beforeAll(connectTestDB);
afterAll(disconnectTestDB);

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const pwd = "password123";

describe("Registration number checks", () => {
  it("accepts a real-looking GSTIN with a valid check character and rejects a typo", () => {
    expect(isValidGstin("27AAPFU0939F1ZV")).toBe(true);
    expect(isValidGstin("27AAPFU0939F1ZX")).toBe(false);
    expect(isValidGstin("not-a-gstin")).toBe(false);
  });

  it("validates ISBN-13 check digits", () => {
    expect(isValidIsbn13("978-0-306-40615-7")).toBe(true);
    expect(isValidIsbn13("9780306406158")).toBe(false);
  });

  it("normalises and validates the other types", () => {
    expect(normaliseRegistration("CIN", " u22110mh2010ptc123456 ")).toBe("U22110MH2010PTC123456");
    expect(normaliseRegistration("CIN", "12345")).toBeNull();
    expect(normaliseRegistration("UDYAM", "udyam-mh-12-1234567")).toBe("UDYAM-MH-12-1234567");
    expect(normaliseRegistration("NOPE", "x")).toBeNull();
  });
});

describe("Admin API", () => {
  let adminToken, adminId, readerToken, readerId, authorToken, authorId, pubToken, pubId, bookId;

  beforeAll(async () => {
    readerToken = await createVerifiedUser({ name: "Adm Reader", email: "adm-reader@example.com", password: pwd, role: "reader" });
    authorToken = await createVerifiedUser({ name: "Adm Author", email: "adm-author@example.com", password: pwd, role: "author" });
    pubToken = await createVerifiedUser({ name: "Adm Pub", email: "adm-pub@example.com", password: pwd, role: "publisher" });
    // admins cannot register through the API - make one directly, as the script does
    await User.create({ name: "The Admin", email: "the-admin@example.com", password: pwd, role: "admin", isEmailVerified: true });
    adminToken = (await request(app).post("/api/auth/login").send({ email: "the-admin@example.com", password: pwd })).body.data.token;

    readerId = (await User.findOne({ email: "adm-reader@example.com" }))._id.toString();
    authorId = (await User.findOne({ email: "adm-author@example.com" }))._id.toString();
    pubId = (await User.findOne({ email: "adm-pub@example.com" }))._id.toString();
    adminId = (await User.findOne({ email: "the-admin@example.com" }))._id.toString();
    bookId = (await Book.create({ title: "Flag Me", description: "d", genre: "fiction", author: authorId, status: "published", plagiarismScore: 55 }))._id.toString();
    await Transaction.create({ sender: readerId, receiver: authorId, amount: 30, type: "book_purchase", status: "completed" });
    await Transaction.create({ sender: readerId, receiver: authorId, amount: 5, type: "p2p_transfer", status: "failed", onChain: false });
  });

  it("is closed to everyone except admins", async () => {
    for (const t of [readerToken, authorToken, pubToken]) {
      const res = await request(app).get("/api/admin/overview").set(auth(t));
      expect(res.status).toBe(403);
    }
    expect((await request(app).get("/api/admin/overview")).status).toBe(401);
  });

  it("can't be reached by registering as admin", async () => {
    const res = await request(app).post("/api/auth/send-otp").send({ name: "Sneaky Admin", email: "sneaky-admin@example.com", password: pwd, role: "admin" });
    const user = await User.findOne({ email: "sneaky-admin@example.com" });
    expect(res.status).toBe(400);
    expect(user).toBeNull();
  });

  it("overview reports users, books, money and things needing attention", async () => {
    const res = await request(app).get("/api/admin/overview").set(auth(adminToken));
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.usersByRole.admin).toBe(1);
    expect(d.usersByRole.reader).toBeGreaterThanOrEqual(1);
    expect(d.booksByStatus.published).toBeGreaterThanOrEqual(1);
    expect(d.totalMoneyMoved).toBe(30); // the failed 5 isn't counted
    expect(d.health.failedPayments).toBe(1);
    expect(d.health.flaggedManuscripts).toBe(1);
    expect(JSON.stringify(d)).not.toMatch(/password|walletPin|otp/i);
  });

  it("lists and filters users, escaping search text", async () => {
    const byRole = await request(app).get("/api/admin/users?role=publisher").set(auth(adminToken));
    expect(byRole.body.data.map((u) => u.email)).toEqual(["adm-pub@example.com"]);
    const search = await request(app).get("/api/admin/users?search=adm-reader").set(auth(adminToken));
    expect(search.body.data).toHaveLength(1);
    const evil = await request(app).get("/api/admin/users?search=.*(").set(auth(adminToken));
    expect(evil.status).toBe(200);
    expect(evil.body.data).toHaveLength(0);
  });

  it("suspending locks the user out of login and of an existing session, and is reversible", async () => {
    const noReason = await request(app).put(`/api/admin/users/${readerId}/suspend`).set(auth(adminToken)).send({});
    expect(noReason.status).toBe(400);

    const ok = await request(app).put(`/api/admin/users/${readerId}/suspend`).set(auth(adminToken)).send({ reason: "Spam" });
    expect(ok.status).toBe(200);

    const session = await request(app).get("/api/auth/profile").set(auth(readerToken));
    expect(session.status).toBe(403);
    expect(session.body.suspended).toBe(true);
    const login = await request(app).post("/api/auth/login").send({ email: "adm-reader@example.com", password: pwd });
    expect(login.status).toBe(403);

    await request(app).put(`/api/admin/users/${readerId}/unsuspend`).set(auth(adminToken)).send({});
    const back = await request(app).get("/api/auth/profile").set(auth(readerToken));
    expect(back.status).toBe(200);
  });

  it("admins can't suspend or re-role themselves, other admins, or make anyone admin", async () => {
    expect((await request(app).put(`/api/admin/users/${adminId}/suspend`).set(auth(adminToken)).send({ reason: "x" })).status).toBe(403);
    const toAdmin = await request(app).put(`/api/admin/users/${authorId}/role`).set(auth(adminToken)).send({ role: "admin" });
    expect(toAdmin.status).toBe(400);
  });

  it("changes a role and records it in the audit log", async () => {
    const res = await request(app).put(`/api/admin/users/${authorId}/role`).set(auth(adminToken)).send({ role: "reader", reason: "requested" });
    expect(res.status).toBe(200);
    expect((await User.findById(authorId)).role).toBe("reader");
    await request(app).put(`/api/admin/users/${authorId}/role`).set(auth(adminToken)).send({ role: "author" });

    const log = await request(app).get("/api/admin/audit-log").set(auth(adminToken));
    expect(log.body.data.map((r) => r.action)).toEqual(expect.arrayContaining(["user.suspend", "user.unsuspend", "user.role"]));
    expect(log.body.data[0].admin.name).toBe("The Admin");
  });

  it("rejects malformed ids with 400, not a crash", async () => {
    expect((await request(app).get("/api/admin/users/not-an-id").set(auth(adminToken))).status).toBe(400);
    expect((await request(app).post("/api/admin/books/xyz/unpublish").set(auth(adminToken)).send({ reason: "r" })).status).toBe(400);
  });

  describe("publisher verification", () => {
    const evidence = {
      companyName: "Adm Pub Press",
      registrationType: "GSTIN",
      registrationNumber: "27AAPFU0939F1ZV",
      documentLink: "https://example.com/gst-certificate.pdf",
      websiteUrl: "https://example.com",
    };

    it("only publishers can ask, and the evidence must be valid", async () => {
      expect((await request(app).post("/api/publisher-verification").set(auth(authorToken)).send(evidence)).status).toBe(403);
      const bad = await request(app).post("/api/publisher-verification").set(auth(pubToken)).send({ ...evidence, registrationNumber: "27AAPFU0939F1ZX" });
      expect(bad.status).toBe(400);
      const noDoc = await request(app).post("/api/publisher-verification").set(auth(pubToken)).send({ ...evidence, documentLink: "javascript:alert(1)" });
      expect(noDoc.status).toBe(400);
    });

    it("a publisher cannot verify themselves by editing their profile", async () => {
      await request(app).put("/api/auth/profile").set(auth(pubToken)).send({ publisherVerification: { isVerified: true, status: "approved" } });
      expect((await User.findById(pubId)).publisherVerification.isVerified).toBe(false);
    });

    it("pending request shows up for the admin; approving verifies and fingerprints it", async () => {
      const sent = await request(app).post("/api/publisher-verification").set(auth(pubToken)).send(evidence);
      expect(sent.status).toBe(201);
      const again = await request(app).post("/api/publisher-verification").set(auth(pubToken)).send(evidence);
      expect(again.status).toBe(400); // already pending

      const list = await request(app).get("/api/admin/publisher-verifications").set(auth(adminToken));
      expect(list.body.data.map((u) => u.email)).toContain("adm-pub@example.com");

      const approve = await request(app).post(`/api/admin/publisher-verifications/${pubId}/approve`).set(auth(adminToken)).send({});
      expect(approve.status).toBe(200);
      expect(approve.body.blockchainHash).toMatch(/^0x[0-9a-f]{64}$/);

      const user = await User.findById(pubId);
      expect(user.publisherVerification.isVerified).toBe(true);
      expect(String(user.publisherVerification.reviewedBy)).toBe(adminId);

      const mine = await request(app).get("/api/publisher-verification/mine").set(auth(pubToken));
      expect(mine.body.data.status).toBe("approved");
      const search = await request(app).get("/api/auth/search?q=Adm Pub").set(auth(authorToken));
      expect(search.body.data.find((u) => u.role === "publisher").publisherVerification.isVerified).toBe(true);
    });

    it("a rejection needs a reason and lets the publisher try again", async () => {
      await User.updateOne({ _id: pubId }, { $set: { "publisherVerification.status": "pending", "publisherVerification.isVerified": false } });
      const noReason = await request(app).post(`/api/admin/publisher-verifications/${pubId}/reject`).set(auth(adminToken)).send({});
      expect(noReason.status).toBe(400);
      const ok = await request(app).post(`/api/admin/publisher-verifications/${pubId}/reject`).set(auth(adminToken)).send({ reason: "Document unreadable" });
      expect(ok.status).toBe(200);
      const mine = await request(app).get("/api/publisher-verification/mine").set(auth(pubToken));
      expect(mine.body.data.status).toBe("rejected");
      expect(mine.body.data.rejectionReason).toBe("Document unreadable");
      const retry = await request(app).post("/api/publisher-verification").set(auth(pubToken)).send(evidence);
      expect(retry.status).toBe(201);
    });

    it("can't approve something that isn't pending", async () => {
      await User.updateOne({ _id: pubId }, { $set: { "publisherVerification.status": "none" } });
      const res = await request(app).post(`/api/admin/publisher-verifications/${pubId}/approve`).set(auth(adminToken)).send({});
      expect(res.status).toBe(400);
    });
  });

  describe("content moderation", () => {
    it("lists flagged manuscripts", async () => {
      const res = await request(app).get("/api/admin/books?flagged=true").set(auth(adminToken));
      expect(res.body.data.map((b) => b.title)).toContain("Flag Me");
    });

    it("unpublish needs a reason, archives the book and tells the author", async () => {
      expect((await request(app).post(`/api/admin/books/${bookId}/unpublish`).set(auth(adminToken)).send({})).status).toBe(400);
      const ok = await request(app).post(`/api/admin/books/${bookId}/unpublish`).set(auth(adminToken)).send({ reason: "Copied text" });
      expect(ok.status).toBe(200);
      expect((await Book.findById(bookId)).status).toBe("archived");
      const again = await request(app).post(`/api/admin/books/${bookId}/unpublish`).set(auth(adminToken)).send({ reason: "Copied text" });
      expect(again.status).toBe(404);
    });

    it("won't delete a book that readers bought, but deletes an unsold one", async () => {
      const sold = await Book.create({ title: "Sold", description: "d", genre: "fiction", author: authorId, status: "published" });
      await User.updateOne({ _id: readerId }, { $push: { purchasedBooks: sold._id } });
      expect((await request(app).delete(`/api/admin/books/${sold._id}`).set(auth(adminToken)).send({ reason: "r" })).status).toBe(409);

      const unsold = await Book.create({ title: "Unsold", description: "d", genre: "fiction", author: authorId, status: "draft" });
      const ok = await request(app).delete(`/api/admin/books/${unsold._id}`).set(auth(adminToken)).send({ reason: "Illegal content" });
      expect(ok.status).toBe(200);
      expect(await Book.findById(unsold._id)).toBeNull();
      expect(await AuditLog.findOne({ action: "book.delete", targetLabel: "Unsold" })).not.toBeNull();
    });
  });

  describe("analytics", () => {
    it("returns zero-filled daily series for the chosen range, with KPIs and top lists", async () => {
      const res = await request(app).get("/api/admin/analytics?days=7").set(auth(adminToken));
      expect(res.status).toBe(200);
      const d = res.body.data;
      expect(d.days).toBe(7);
      expect(d.signups).toHaveLength(7);
      expect(d.money).toHaveLength(7);
      // dates are consecutive, oldest first, ending today (UTC)
      expect(d.signups[6].date).toBe(new Date().toISOString().slice(0, 10));
      // everything in this test file was created today
      expect(d.kpis.newUsers.value).toBe(d.signups.reduce((n, s) => n + s.value, 0));
      expect(d.kpis.newUsers.value).toBeGreaterThanOrEqual(4);
      expect(d.kpis.newUsers.change).toBeNull(); // nothing in the previous period to compare against
      expect(d.kpis.moneyMoved.value).toBe(30); // the completed purchase; the failed transfer is excluded
      expect(d.money[6].book_purchase).toBe(30);
      expect(d.moneyTypes).toEqual(["book_purchase", "publishing_fee", "p2p_transfer"]);
      expect(d.activity.length).toBeGreaterThan(0);
      expect(JSON.stringify(d)).not.toMatch(/password|walletPin|otp/i);
    });

    it("falls back to 30 days for an unsupported range and is admin-only", async () => {
      const odd = await request(app).get("/api/admin/analytics?days=9999").set(auth(adminToken));
      expect(odd.body.data.days).toBe(30);
      expect(odd.body.data.signups).toHaveLength(30);
      expect((await request(app).get("/api/admin/analytics").set(auth(readerToken))).status).toBe(403);
    });
  });

  describe("transactions and health", () => {
    it("lists payments with filters and a total, read-only", async () => {
      const all = await request(app).get("/api/admin/transactions").set(auth(adminToken));
      expect(all.body.total).toBe(2);
      const failed = await request(app).get("/api/admin/transactions?status=failed").set(auth(adminToken));
      expect(failed.body.data).toHaveLength(1);
      expect(failed.body.totalAmount).toBe(5);
      const post = await request(app).post("/api/admin/transactions").set(auth(adminToken)).send({});
      expect(post.status).toBe(404);
    });

    it("health lists failed payments and stuck submissions", async () => {
      const old = await Book.create({ title: "Stuck", description: "d", genre: "fiction", author: authorId, publisher: pubId, status: "under_review" });
      await Book.collection.updateOne({ _id: old._id }, { $set: { updatedAt: new Date(Date.now() - 30 * 24 * 3600 * 1000) } });
      const res = await request(app).get("/api/admin/health").set(auth(adminToken));
      expect(res.body.data.failedTransactions).toHaveLength(1);
      expect(res.body.data.stuckSubmissions.map((b) => b.title)).toContain("Stuck");
    });
  });
});
