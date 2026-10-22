// One-off repair: accounts created before the wallet existed have no stored
// balance (the app showed the default $1000 for them, but payments need a real
// number). This stores the default for every account that lacks one, and a 0
// for missing earnings. Safe to run repeatedly.
//   node scripts/backfillWallets.js
require("dotenv").config();
const mongoose = require("mongoose");

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Database: ${mongoose.connection.name}`);
  const users = mongoose.connection.collection("users");
  const balance = await users.updateMany({ walletBalance: { $exists: false } }, { $set: { walletBalance: 1000 } });
  const earnings = await users.updateMany({ earnings: { $exists: false } }, { $set: { earnings: 0 } });
  console.log(`Gave ${balance.modifiedCount} account(s) the starting balance of 1000.`);
  console.log(`Set earnings to 0 on ${earnings.modifiedCount} account(s).`);
  await mongoose.disconnect();
})().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
