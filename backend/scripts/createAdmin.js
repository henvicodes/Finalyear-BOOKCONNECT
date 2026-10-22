// Creates (or promotes) an administrator. Admins can't be created through the
// website on purpose - this script, run on the server, is the only way.
//
//   node scripts/createAdmin.js you@example.com "Your Name"
//
// The password is typed at the prompt (hidden), never on the command line, so it
// doesn't end up in your shell history.
require("dotenv").config();
const fs = require("fs");
const mongoose = require("mongoose");
const User = require("../models/User");

let pipedLines = null; // used only when input is piped in (tests, scripts), not typed

// Asks a question and returns the typed answer without echoing it on screen.
function askHidden(question) {
  process.stdout.write(question);

  if (!process.stdin.isTTY) {
    if (pipedLines === null) pipedLines = fs.readFileSync(0, "utf8").split(/\r?\n/);
    process.stdout.write("\n");
    return Promise.resolve(pipedLines.shift() || "");
  }

  return new Promise((resolve) => {
    const stdin = process.stdin;
    let value = "";
    const finish = () => {
      stdin.removeListener("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
    };
    const onData = (chunk) => {
      for (const ch of chunk) {
        if (ch === "\r" || ch === "\n") {
          finish();
          return resolve(value);
        }
        if (ch === "\u0003") {
          // Ctrl+C
          finish();
          process.exit(130);
        }
        if (ch === "\u007f" || ch === "\b") value = value.slice(0, -1); // backspace
        else if (ch >= " ") value += ch;
      }
    };
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
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
  console.log(`Database: ${mongoose.connection.name}`);
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
    console.log("You can now log in at the app's login page with that email and password.");
  } finally {
    await mongoose.disconnect();
  }
})().catch((err) => {
  console.error("Failed:", err.message);
  process.exit(1);
});
