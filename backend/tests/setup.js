const mongoose = require("mongoose");

// Runs against a dedicated `_test` database (derived from MONGO_URI) so
// tests never touch real seeded/dev data. The database is dropped after
// each test file finishes.
function getTestMongoUri() {
  const base = process.env.MONGO_URI || "mongodb://localhost:27017/bookConnect";
  const [withoutQuery, query] = base.split("?");
  const testUri = withoutQuery.endsWith("_test") ? withoutQuery : `${withoutQuery}_test`;
  return query ? `${testUri}?${query}` : testUri;
}

async function connectTestDB() {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(getTestMongoUri());
  }
}

async function disconnectTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

module.exports = { connectTestDB, disconnectTestDB, getTestMongoUri };
