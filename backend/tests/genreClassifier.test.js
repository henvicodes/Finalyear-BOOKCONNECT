const request = require("supertest");
const app = require("../app");
const User = require("../models/User");
const { scoreGenres, knownWordCount } = require("../utils/genreClassifier");
const parity = require("../../ml/reports/genre_parity_samples.json");
const { connectTestDB, disconnectTestDB } = require("./setup");
const { createVerifiedUser } = require("./helpers");

beforeAll(connectTestDB);
afterAll(disconnectTestDB);

describe("Genre classifier (trained on CMU Book Summary Dataset)", () => {
  // The JS scorer must reproduce the Python/sklearn model exactly — otherwise
  // the numbers we report from training wouldn't describe what the app does.
  test("matches the Python model's probabilities on held-out books", () => {
    for (const sample of parity) {
      const js = Object.fromEntries(scoreGenres(sample.text).map((s) => [s.genre, s.probability]));
      const genres = require("../ml/genre_classifier.json").genres;
      genres.forEach((genre, i) => {
        // Small tolerance: exported weights are rounded to 4 decimals.
        expect(Math.abs(js[genre] - sample.probs[i])).toBeLessThan(0.01);
      });
    }
  });

  test("a clearly fantasy passage ranks fantasy first", () => {
    const text =
      "The young wizard travelled across the kingdom with his sword and a dragon, " +
      "seeking the lost magic crown of the elves. The dark sorcerer and his army of " +
      "goblins ruled the realm, and the prophecy said only a chosen hero with an " +
      "enchanted blade could break the spell and restore the king to his throne.";
    expect(scoreGenres(text)[0].genre).toBe("fantasy");
  });

  test("a clearly crime passage ranks mystery or thriller first", () => {
    const text =
      "Detective Marlowe examined the body in the locked study. The murder weapon " +
      "was missing, every suspect had an alibi, and the killer had left a single clue: " +
      "a torn letter. The inspector interviewed the witnesses and slowly pieced the " +
      "crime together before the murderer could escape the city.";
    expect(["mystery", "thriller"]).toContain(scoreGenres(text)[0].genre);
  });

  test("returns probabilities between 0 and 1, sorted highest first", () => {
    const scores = scoreGenres("A story about a boy, a robot and a spaceship that travelled to another galaxy.");
    scores.forEach((s) => {
      expect(s.probability).toBeGreaterThanOrEqual(0);
      expect(s.probability).toBeLessThanOrEqual(1);
    });
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1].probability).toBeGreaterThanOrEqual(scores[i].probability);
    }
  });

  test("counts only words the model knows", () => {
    expect(knownWordCount("zzzqqq xxyyzz")).toBe(0);
    expect(knownWordCount("The wizard drew his sword")).toBeGreaterThan(0);
  });
});

describe("POST /api/ai/suggest-genre", () => {
  let token;

  beforeAll(async () => {
    const email = "genre-test-author@example.com";
    token = await createVerifiedUser({ name: "Genre Tester", email, password: "password123", role: "author" });
  });

  test("requires login", async () => {
    const res = await request(app).post("/api/ai/suggest-genre").send({ text: "anything" });
    expect(res.status).toBe(401);
  });

  test("refuses to guess from too little text", async () => {
    const res = await request(app)
      .post("/api/ai/suggest-genre")
      .set("Authorization", `Bearer ${token}`)
      .send({ text: "A short line." });
    expect(res.status).toBe(400);
  });

  test("returns top-3 suggestions with probabilities", async () => {
    const text =
      "The dragon rider raised her enchanted sword as the sorcerer cast a dark spell " +
      "over the ancient kingdom, and the elves, dwarves and wizards gathered in the " +
      "great hall to plan the final battle against the demon king and his army. " +
      "The prophecy spoke of a lost crown hidden beneath the mountain, guarded by a " +
      "cursed dragon, and only a chosen hero with a magic blade could claim it and " +
      "free the realm from the shadow of the necromancer's dark magic.";
    const res = await request(app)
      .post("/api/ai/suggest-genre")
      .set("Authorization", `Bearer ${token}`)
      .send({ text });
    expect(res.status).toBe(200);
    expect(res.body.suggestions).toHaveLength(3);
    expect(res.body.suggestions[0].genre).toBe("fantasy");
    expect(res.body.model.metrics.top1_hit_rate).toBeGreaterThan(0.5);
  });
});
