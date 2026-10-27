const User = require("../models/User");

const seedAdmin = async () => {
  try {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@bookconnect.com";
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (!existingAdmin) {
      await User.create({
        name: "System Administrator",
        email: adminEmail,
        password: process.env.ADMIN_PASSWORD || "password123",
        role: "admin",
        isVerified: true,
        isEmailVerified: true,
        walletBalance: 99999,
        bio: "Master administrator for BookConnect platform with complete administrative authority across readers, authors, and publishers.",
        profilePicture: "https://api.dicebear.com/7.x/bottts/svg?seed=Admin",
        blockchainWallet: {
          address: "0xAdmin000000000000000000000000000000000001",
          isLinked: true
        },
        publisherVerification: {
          isVerified: true,
          documentLink: "https://docs.google.com/document/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit",
          blockchainHash: "0xAdminProofLedger00000000000000000000000000000000000000000000000001"
        }
      });
      console.log(`🛡️ Default Admin account seeded: ${adminEmail} (password: ${process.env.ADMIN_PASSWORD || "password123"})`);
    }
  } catch (error) {
    console.error("Admin seed check error:", error.message);
  }
};

module.exports = seedAdmin;
