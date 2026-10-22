const fs = require("fs");
const os = require("os");
const path = require("path");
const request = require("supertest");

// ---- e-mail through an HTTP provider ---------------------------------------
describe("Sending the verification e-mail through Brevo", () => {
  const saved = { ...process.env };
  let emailService;
  let fetchMock;

  beforeEach(() => {
    process.env.BREVO_API_KEY = "test-key";
    process.env.EMAIL_FROM = "hello@bookconnect.test";
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    jest.isolateModules(() => {
      emailService = require("../services/emailService");
    });
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("posts the message to the Brevo API with the key in a header", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ messageId: "x" }) });

    await emailService.sendOTPEmail("reader@example.com", "Ria", "123456");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect(options.headers["api-key"]).toBe("test-key");
    const body = JSON.parse(options.body);
    expect(body.sender.email).toBe("hello@bookconnect.test");
    expect(body.to).toEqual([{ email: "reader@example.com", name: "Ria" }]);
    expect(body.htmlContent).toContain("123456");
  });

  it("fails loudly when the provider refuses the message", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: "Key not found" }) });
    jest.spyOn(console, "error").mockImplementation(() => {});

    await expect(emailService.sendOTPEmail("reader@example.com", "Ria", "123456")).rejects.toThrow(/401.*Key not found/);
  });
});

// ---- what the user sees if the e-mail can't be sent -----------------------
describe("Registration when the e-mail cannot be sent", () => {
  const { connectTestDB, disconnectTestDB } = require("./setup");
  const app = require("../app");
  const emailService = require("../services/emailService");
  const User = require("../models/User");
  const body = (n) => ({ name: "Mail Fail", email: `mailfail${n}@example.com`, password: "password123", role: "reader" });

  beforeAll(connectTestDB);
  afterAll(disconnectTestDB);
  beforeEach(() => {
    jest.spyOn(emailService, "sendOTPEmail").mockRejectedValue(new Error("provider down"));
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "log").mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    process.env.NODE_ENV = "test";
  });

  it("tells the user in production instead of pretending the code was sent", async () => {
    process.env.NODE_ENV = "production";
    const res = await request(app).post("/api/auth/send-otp").send(body(1));
    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
  });

  it("keeps working in development (the code is printed to the console)", async () => {
    const res = await request(app).post("/api/auth/send-otp").send(body(2));
    expect(res.status).toBe(200);
    await User.deleteMany({ email: /^mailfail/ });
  });
});

// ---- serving the built website from the same server -----------------------
describe("Serving the built frontend", () => {
  let dist;
  let app;

  beforeAll(() => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), "bc-dist-"));
    fs.mkdirSync(path.join(dist, "assets"));
    fs.writeFileSync(
      path.join(dist, "index.html"),
      '<!doctype html><html><head><script>window.theme=1</script></head><body><div id="root">APP</div></body></html>'
    );
    fs.writeFileSync(path.join(dist, "assets", "app-1.js"), "console.log('app')");
    process.env.FRONTEND_DIST = dist;
    jest.isolateModules(() => {
      app = require("../app");
    });
  });
  afterAll(() => {
    delete process.env.FRONTEND_DIST;
    fs.rmSync(dist, { recursive: true, force: true });
  });

  it("serves the app at the home address", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("APP");
  });

  it("serves the app for a page address so refresh and shared links work", async () => {
    const res = await request(app).get("/dashboard/profile");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/html/);
    expect(res.text).toContain("APP");
  });

  it("serves built files with long caching", async () => {
    const res = await request(app).get("/assets/app-1.js");
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toMatch(/immutable/);
  });

  it("answers a missing file with 404, not the web page", async () => {
    expect((await request(app).get("/assets/missing.js")).status).toBe(404);
    expect((await request(app).get("/logo.png")).status).toBe(404);
  });

  it("never lets the web page swallow the API", async () => {
    const health = await request(app).get("/api/health");
    expect(health.body).toEqual({ status: "ok" });
    const unknown = await request(app).get("/api/does-not-exist");
    expect(unknown.status).toBe(404);
    expect(unknown.body.success).toBe(false);
  });
});

describe("Behind a hosting proxy", () => {
  it("only trusts forwarded addresses when TRUST_PROXY is set", () => {
    process.env.TRUST_PROXY = "1";
    let proxied;
    jest.isolateModules(() => {
      proxied = require("../app");
    });
    delete process.env.TRUST_PROXY;
    let local;
    jest.isolateModules(() => {
      local = require("../app");
    });
    expect(proxied.get("trust proxy")).toBe(1);
    expect(local.get("trust proxy")).toBe(false);
  });
});
