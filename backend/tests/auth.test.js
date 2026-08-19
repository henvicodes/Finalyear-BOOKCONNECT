const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const { connectTestDB, disconnectTestDB } = require("./setup");

beforeAll(connectTestDB);
afterAll(disconnectTestDB);

describe("Auth: registration + login", () => {
  const testUser = {
    name: "Test Reader",
    email: "test-reader@example.com",
    password: "password123",
    role: "reader",
  };

  it("sends a registration OTP and stores it on the (unverified) user", async () => {
    const res = await request(app).post("/api/auth/send-otp").send(testUser);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testUser.email);

    // The OTP is emailed, not returned in the API response — read it
    // directly from the DB the same way a real email would deliver it.
    const stored = await User.findOne({ email: testUser.email }).select("+otpCode");
    expect(stored).not.toBeNull();
    expect(stored.otpCode).toMatch(/^\d{6}$/);
    expect(stored.isEmailVerified).toBe(false);
  });

  it("rejects verification with a wrong OTP", async () => {
    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: testUser.email, otp: "000000" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("completes registration with the correct OTP and returns a JWT", async () => {
    const stored = await User.findOne({ email: testUser.email }).select("+otpCode");

    const res = await request(app)
      .post("/api/auth/verify-otp")
      .send({ email: testUser.email, otp: stored.otpCode });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testUser.email);
    expect(res.body.data.isEmailVerified).toBe(true);
    expect(typeof res.body.data.token).toBe("string");
  });

  it("rejects login with the wrong password", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testUser.email, password: "wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("logs in successfully with the correct credentials", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: testUser.email, password: testUser.password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(testUser.email);
    expect(typeof res.body.data.token).toBe("string");
  });

  it("rejects /api/auth/profile without a token", async () => {
    const res = await request(app).get("/api/auth/profile");
    expect(res.status).toBe(401);
  });

  it("returns the profile for a valid token", async () => {
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: testUser.email, password: testUser.password });
    const token = login.body.data.token;

    const res = await request(app)
      .get("/api/auth/profile")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe(testUser.email);
  });
});
