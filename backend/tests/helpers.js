const request = require("supertest");
const app = require("../app");
// Module object, so the spy below replaces the function authController calls.
const emailService = require("../services/emailService");

// The OTP is only ever e-mailed (and stored hashed), so tests intercept the
// "send e-mail" step and keep the code, the same way a user would read it from
// their inbox.
const sentOtps = {};

beforeAll(() => {
  jest.spyOn(emailService, "sendOTPEmail").mockImplementation(async (email, name, otp) => {
    sentOtps[email] = otp;
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

const lastOtp = (email) => sentOtps[email];

// Registers + verifies a user through the real API (same path a real user takes).
// Returns the auth token.
async function createVerifiedUser({ name, email, password, role }) {
  await request(app).post("/api/auth/send-otp").send({ name, email, password, role });
  const verify = await request(app).post("/api/auth/verify-otp").send({ email, otp: lastOtp(email) });
  return verify.body.data.token;
}

// Sets the wallet PIN for the logged-in user.
async function setWalletPin(token, pin = "1234") {
  const res = await request(app)
    .post("/api/blockchain/set-pin")
    .set("Authorization", `Bearer ${token}`)
    .send({ pin });
  return res;
}

module.exports = { createVerifiedUser, setWalletPin, lastOtp };
