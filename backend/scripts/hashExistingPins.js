// One-off migration: older accounts stored the wallet PIN in plain text.
// This replaces every plain PIN with a bcrypt hash. Safe to run repeatedly.
//   node scripts/hashExistingPins.js
require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = mongoose.connection.collection("users");
  const plain = await users
    .find({ walletPin: { $type: "string", $not: /^\$2[aby]\$/ } })
    .project({ walletPin: 1 })
    .toArray();

  for (const u of plain) {
    await users.updateOne({ _id: u._id }, { $set: { walletPin: await bcrypt.hash(String(u.walletPin), 10) } });
  }
  console.log(`Hashed ${plain.length} plain-text PIN(s).`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error("Migration failed:", err.message);
  process.exit(1);
});
