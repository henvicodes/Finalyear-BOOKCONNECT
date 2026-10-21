// Creates (or promotes) an administrator. Admins can't be created through the
// website on purpose - this script, run on the server, is the only way.
//
//   node scripts/createAdmin.js you@example.com "Your Name"
//
// The password is typed at the prompt (hidden), never on the command line, so it
// doesn't end up in your shell history.
require("dotenv").config();
const readline = require("readline");
const mongoose = require("mongoose");
const User = require("../models/User");

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      // print the question, but echo nothing while typing
      if (text.startsWith(question)) rl.output.write(text);
    };
    rl.question(question, (answer) => {
      rl.output.write("\n");
      rl.close();
      resolve(answer);
    });
  });
}

(async () => {
  const [email, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ").trim();
  if (!email || !name) {
    console.error('Usage: node scripts/createAdmin.js you@example.com "Your Name"');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  try {
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      if (existing.role === "admin") {
        console.log("That account is already an admin.");
      } else {
        existing.role = "admin";
        existing.isEmailVerified = true;
        await existing.save();
        console.log(`Promoted ${existing.email} to admin (their password is unchanged).`);
      }
      return;
    }

    const password = await askHidden("Choose a password (min 8 characters): ");
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
    const again = await askHidden("Repeat the password: ");
    if (again !== password) throw new Error("Passwords did not match.");

    await User.create({ name, email, password, role: "admin", isEmailVerified: true });
    console.log(`Admin created: ${email.toLowerCase()}`);
  } finally {
    await mongoose.disconnect();
  }
})().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
