// Runs BookConnect on the DEMO database, so your real data is never touched.
//
//   npm run demo        start the backend on the demo database
//   npm run demo:seed   (re)fill the demo database with sample users, books and payments
//
// The demo database is your normal database name plus "_demo" (for example
// bookConnect -> bookConnect_demo). Log in as admin@bookconnect.com / DemoAdmin123.
// Works the same in PowerShell, cmd and bash: no environment variable to set by hand.
require("dotenv").config();

const base = process.env.MONGO_URI || "mongodb://localhost:27017/bookConnect";
const [withoutQuery, query] = base.split("?");
const demoUri = withoutQuery.replace(/(_demo)?$/, "_demo") + (query ? `?${query}` : "");
process.env.MONGO_URI = demoUri;

const dbName = demoUri.split("?")[0].split("/").pop();
const seeding = process.argv[2] === "seed";

console.log(`\nDEMO MODE: using database "${dbName}" (your real data is not used)`);
if (!seeding) {
  console.log("Log in as admin@bookconnect.com / DemoAdmin123");
  console.log("If the demo database is empty, run:  npm run demo:seed  first\n");
}

require(seeding ? "./seedAdminDemo" : "../server");
