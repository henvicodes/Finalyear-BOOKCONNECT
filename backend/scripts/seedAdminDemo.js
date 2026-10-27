// Fills a DEMO database with 90 days of believable activity so the admin
// dashboard's charts and lists have something to show.
//
//   MONGO_URI=mongodb://localhost:27017/bookConnect_demo node scripts/seedAdminDemo.js
//
// Safety: it refuses to run unless the database name ends in "_demo", and it
// wipes that database first, so it can never touch your real data.
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const uri = process.env.MONGO_URI || "";
const dbName = (uri.split("?")[0].split("/").pop() || "").trim();
if (!dbName.endsWith("_demo")) {
  console.error(`Refusing to run: database "${dbName}" doesn't end in "_demo".`);
  console.error("Example: MONGO_URI=mongodb://localhost:27017/bookConnect_demo node scripts/seedAdminDemo.js");
  process.exit(1);
}

// small deterministic generator so the demo looks the same every time
let seed = 20261022;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const between = (a, b) => a + Math.floor(rand() * (b - a + 1));
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY - between(0, 20) * 3600 * 1000);
// more recent days get more activity (a growing platform)
const growthDay = () => Math.floor(Math.pow(rand(), 1.6) * 90);

const FIRST = ["Aarav", "Diya", "Kabir", "Meera", "Rohan", "Isha", "Vihaan", "Anaya", "Arjun", "Saanvi", "Neel", "Tara", "Dev", "Riya", "Yash", "Kiara", "Om", "Nisha", "Karan", "Pooja"];
const LAST = ["Sharma", "Patel", "Nair", "Rao", "Kulkarni", "Mehta", "Iyer", "Gupta", "Joshi", "Bose", "Das", "Khan"];
const GENRES = ["fiction", "non-fiction", "science", "technology", "poetry", "drama", "history", "biography"];
const TITLES = ["The Last Monsoon", "Paper Lanterns", "Code of the Rivers", "Midnight in Jaipur", "A Quiet Revolution", "The Salt Road", "Letters to Nowhere", "Stars Over Kochi", "The Cartographer's Daughter", "Ink and Ember", "Winter Harvest", "The Clockmaker of Pune", "Echoes of Hampi", "Neon Bazaar", "The Silent Examiner", "Thread of Gold", "Seven Doors", "Under the Banyan", "The Glass Orchard", "Tides of Goa", "Rails to Nowhere", "A Season of Rain", "The Tin Lantern", "Beyond the Ghats"];

(async () => {
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  const db = mongoose.connection;
  const hash = await bcrypt.hash("DemoAdmin123", 10);
  const oid = () => new mongoose.Types.ObjectId();

  const user = (name, role, createdAt, extra = {}) => ({
    _id: oid(), name, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}.${between(100, 999)}@example.com`, password: hash,
    role, isEmailVerified: true, isVerified: false, walletBalance: 1000, earnings: 0, purchasedBooks: [], interests: [],
    pinFailedAttempts: 0, createdAt, updatedAt: createdAt, ...extra,
  });
  const fullName = () => `${pick(FIRST)} ${pick(LAST)}`;

  const admin = user("BookConnect Admin", "admin", daysAgo(120), { email: "admin@bookconnect.com" });
  const publishers = Array.from({ length: 4 }, (_, i) => user(`${pick(LAST)} Press ${i + 1}`, "publisher", daysAgo(between(60, 100))));
  publishers[0].publisherVerification = { status: "approved", isVerified: true, companyName: publishers[0].name, registrationType: "GSTIN", registrationNumber: "27AAPFU0939F1ZV", documentLink: "https://example.com/doc.pdf", reviewedAt: daysAgo(40), reviewedBy: admin._id };
  publishers[1].publisherVerification = { status: "pending", isVerified: false, companyName: publishers[1].name, registrationType: "CIN", registrationNumber: "U22110MH2010PTC123456", documentLink: "https://example.com/cin.pdf", submittedAt: daysAgo(1) };
  publishers[2].publisherVerification = { status: "pending", isVerified: false, companyName: publishers[2].name, registrationType: "UDYAM", registrationNumber: "UDYAM-MH-12-1234567", documentLink: "https://example.com/udyam.pdf", submittedAt: daysAgo(3) };
  const authors = Array.from({ length: 10 }, () => user(fullName(), "author", daysAgo(between(20, 95))));
  const readers = Array.from({ length: 70 }, () => user(fullName(), "reader", daysAgo(growthDay())));
  readers[3].isSuspended = true;
  readers[3].suspendedReason = "Spam messages";
  readers[3].suspendedAt = daysAgo(5);

  // books
  const statuses = ["published", "published", "published", "published", "published", "draft", "under_review", "seen", "cost_proposed", "declined", "archived"];
  const books = TITLES.map((title, i) => {
    const status = i < 14 ? "published" : pick(statuses);
    const created = daysAgo(growthDay());
    const author = pick(authors);
    const paid = rand() < 0.55;
    return {
      _id: oid(), title, description: `${title}, a story that readers keep recommending.`, genre: pick(GENRES), author: author._id, status,
      isPaid: paid, price: paid ? between(3, 25) : 0, totalReads: status === "published" ? between(5, 900) : 0, ratings: [], averageRating: 0, totalRatings: 0,
      publisher: ["under_review", "seen", "cost_proposed"].includes(status) ? pick(publishers)._id : null,
      publishingCost: status === "cost_proposed" ? between(50, 400) : 0,
      plagiarismScore: rand() < 0.2 ? between(22, 70) : between(0, 12), chapters: [], versionHistory: [], createdAt: created, updatedAt: created, language: "english", tags: [],
      ...(i === 20 ? { updatedAt: daysAgo(30) } : {}),
    };
  });
  books.forEach((b) => {
    if (b.status !== "published") return;
    const n = between(0, 9);
    for (let k = 0; k < n; k++) b.ratings.push({ user: pick(readers)._id, rating: between(3, 5), createdAt: daysAgo(growthDay()) });
    b.totalRatings = b.ratings.length;
    b.averageRating = n ? Math.round((b.ratings.reduce((s, r) => s + r.rating, 0) / n) * 10) / 10 : 0;
  });
  const published = books.filter((b) => b.status === "published");

  // payments
  const txs = [];
  const authorById = Object.fromEntries([...authors, ...publishers].map((u) => [u._id.toString(), u]));
  for (let i = 0; i < 260; i++) {
    const t = rand();
    const at = daysAgo(growthDay());
    const onChain = rand() < 0.3;
    const base = { _id: oid(), onChain, network: onChain ? "sepolia" : undefined, status: rand() < 0.03 ? "failed" : "completed", note: "", createdAt: at, updatedAt: at };
    if (onChain) base.txHash = "0x" + Array.from({ length: 64 }, () => between(0, 15).toString(16)).join("");
    if (t < 0.72) {
      const book = pick(published.filter((b) => b.isPaid));
      const buyer = pick(readers);
      txs.push({ ...base, sender: buyer._id, receiver: book.author, amount: book.price, type: "book_purchase", note: `Purchased book "${book.title}"` });
      if (base.status === "completed") {
        authorById[book.author.toString()].earnings += book.price;
        buyer.purchasedBooks.push(book._id);
      }
    } else if (t < 0.9) {
      const pub = pick(publishers);
      const cost = between(50, 400);
      txs.push({ ...base, sender: pick(authors)._id, receiver: pub._id, amount: cost, type: "publishing_fee", note: "Paid publishing fee" });
      if (base.status === "completed") pub.earnings += cost;
    } else {
      txs.push({ ...base, sender: pick(readers)._id, receiver: pick(authors)._id, amount: between(2, 40), type: "p2p_transfer", note: "Web3 P2P Payment Transfer" });
    }
  }

  // admin history
  const audit = [
    { admin: admin._id, action: "user.suspend", targetType: "user", targetId: readers[3]._id, targetLabel: readers[3].email, details: "Spam messages", createdAt: daysAgo(5) },
    { admin: admin._id, action: "publisher.approve", targetType: "publisher_verification", targetId: publishers[0]._id, targetLabel: publishers[0].name, details: "GSTIN 27AAPFU0939F1ZV", createdAt: daysAgo(40) },
    { admin: admin._id, action: "book.unpublish", targetType: "book", targetId: books[22]._id, targetLabel: books[22].title, details: "Copied text", createdAt: daysAgo(12) },
  ];

  const all = [admin, ...publishers, ...authors, ...readers];
  await db.collection("users").insertMany(all);
  await db.collection("books").insertMany(books);
  await db.collection("transactions").insertMany(txs);
  await db.collection("auditlogs").insertMany(audit);

  console.log(`Seeded ${all.length} users, ${books.length} books, ${txs.length} payments into "${dbName}".`);
  console.log("Log in as admin@bookconnect.com / DemoAdmin123 (demo database only).");
  await mongoose.disconnect();
})().catch((err) => {
  console.error("Seeding failed:", err.message);
  process.exit(1);
});
