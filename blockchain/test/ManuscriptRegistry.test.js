const { expect } = require("chai");
const { ethers } = require("hardhat");

// Helper: derive a deterministic bytes32 manuscriptId from a string (stand-in
// for a MongoDB ObjectId), and a bytes32 content hash the same way the app's
// backend computes SHA-256 hashes elsewhere.
const toBytes32 = (text) => ethers.keccak256(ethers.toUtf8Bytes(text));

describe("ManuscriptRegistry", function () {
  let registry;
  let author, otherAuthor;

  beforeEach(async function () {
    [author, otherAuthor] = await ethers.getSigners();
    const Registry = await ethers.getContractFactory("ManuscriptRegistry");
    registry = await Registry.deploy();
  });

  it("registers a new manuscript and emits ManuscriptRegistered", async function () {
    const manuscriptId = toBytes32("manuscript-1");
    const contentHash = toBytes32("Once upon a time...");

    await expect(registry.registerManuscript(manuscriptId, contentHash))
      .to.emit(registry, "ManuscriptRegistered")
      .withArgs(manuscriptId, author.address, contentHash, anyValue());

    const reg = await registry.registrations(manuscriptId);
    expect(reg.author).to.equal(author.address);
    expect(reg.exists).to.equal(true);
    expect(await registry.getVersionCount(manuscriptId)).to.equal(1);
  });

  it("rejects registering the same manuscript twice", async function () {
    const manuscriptId = toBytes32("manuscript-2");
    const contentHash = toBytes32("Some content");

    await registry.registerManuscript(manuscriptId, contentHash);

    await expect(
      registry.registerManuscript(manuscriptId, contentHash)
    ).to.be.revertedWith("Manuscript already registered");
  });

  it("rejects registering with an empty content hash", async function () {
    const manuscriptId = toBytes32("manuscript-3");
    await expect(
      registry.registerManuscript(manuscriptId, ethers.ZeroHash)
    ).to.be.revertedWith("Content hash required");
  });

  it("verifies a matching content hash as true, a changed one as false", async function () {
    const manuscriptId = toBytes32("manuscript-4");
    const originalHash = toBytes32("original text");
    const tamperedHash = toBytes32("tampered text");

    await registry.registerManuscript(manuscriptId, originalHash);

    expect(await registry.verifyManuscript(manuscriptId, originalHash)).to.equal(true);
    expect(await registry.verifyManuscript(manuscriptId, tamperedHash)).to.equal(false);
  });

  it("lets the original author push a new version via updateManuscript", async function () {
    const manuscriptId = toBytes32("manuscript-5");
    const v1 = toBytes32("draft v1");
    const v2 = toBytes32("draft v2, revised");

    await registry.registerManuscript(manuscriptId, v1);
    await expect(registry.updateManuscript(manuscriptId, v2))
      .to.emit(registry, "ManuscriptUpdated")
      .withArgs(manuscriptId, v2, anyValue());

    expect(await registry.getVersionCount(manuscriptId)).to.equal(2);
    expect(await registry.verifyManuscript(manuscriptId, v2)).to.equal(true);
    expect(await registry.verifyManuscript(manuscriptId, v1)).to.equal(false); // superseded

    const history = await registry.getHistory(manuscriptId);
    expect(history.length).to.equal(2);
    expect(history[0].contentHash).to.equal(v1);
    expect(history[1].contentHash).to.equal(v2);
  });

  it("rejects updateManuscript from a wallet that isn't the registering author", async function () {
    const manuscriptId = toBytes32("manuscript-6");
    await registry.registerManuscript(manuscriptId, toBytes32("original"));

    await expect(
      registry.connect(otherAuthor).updateManuscript(manuscriptId, toBytes32("hijacked"))
    ).to.be.revertedWith("Only the registering author can update this manuscript");
  });

  it("rejects updateManuscript on a manuscript that was never registered", async function () {
    const manuscriptId = toBytes32("never-registered");
    await expect(
      registry.updateManuscript(manuscriptId, toBytes32("content"))
    ).to.be.revertedWith("Manuscript not registered");
  });
});

// Minimal stand-in for chai-matchers' anyValue when only the timestamp arg
// needs to be "don't care" — keeps the test file dependency-light.
function anyValue() {
  return (x) => typeof x !== "undefined";
}
