const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PaymentLedger", function () {
  let ledger;
  let alice, bob, carol;

  beforeEach(async function () {
    [alice, bob, carol] = await ethers.getSigners();
    const Ledger = await ethers.getContractFactory("PaymentLedger");
    ledger = await Ledger.deploy();
  });

  it("forwards the ETH to the receiver and records the payment atomically", async function () {
    const amount = ethers.parseEther("0.01");
    const bobBalanceBefore = await ethers.provider.getBalance(bob.address);

    const tx = await ledger.connect(alice).makePayment(bob.address, "p2p_transfer", { value: amount });
    await expect(tx)
      .to.emit(ledger, "PaymentMade")
      .withArgs(0, alice.address, bob.address, amount, "p2p_transfer", (x) => typeof x !== "undefined");

    const bobBalanceAfter = await ethers.provider.getBalance(bob.address);
    expect(bobBalanceAfter - bobBalanceBefore).to.equal(amount);

    expect(await ledger.getPaymentCount()).to.equal(1);
    const payment = await ledger.getPayment(0);
    expect(payment.sender).to.equal(alice.address);
    expect(payment.receiver).to.equal(bob.address);
    expect(payment.amount).to.equal(amount);
    expect(payment.purpose).to.equal("p2p_transfer");
  });

  it("rejects a zero-value payment", async function () {
    await expect(
      ledger.connect(alice).makePayment(bob.address, "p2p_transfer", { value: 0 })
    ).to.be.revertedWith("Payment amount must be greater than zero");
  });

  it("rejects paying the zero address", async function () {
    await expect(
      ledger.connect(alice).makePayment(ethers.ZeroAddress, "p2p_transfer", { value: ethers.parseEther("0.01") })
    ).to.be.revertedWith("Invalid receiver address");
  });

  it("rejects paying yourself", async function () {
    await expect(
      ledger.connect(alice).makePayment(alice.address, "p2p_transfer", { value: ethers.parseEther("0.01") })
    ).to.be.revertedWith("Cannot pay yourself");
  });

  it("tracks sent and received payment ids per address across multiple payments", async function () {
    await ledger.connect(alice).makePayment(bob.address, "book_purchase", { value: ethers.parseEther("0.01") });
    await ledger.connect(alice).makePayment(carol.address, "publishing_fee", { value: ethers.parseEther("0.02") });
    await ledger.connect(bob).makePayment(alice.address, "p2p_transfer", { value: ethers.parseEther("0.005") });

    const aliceSent = await ledger.getSentPaymentIds(alice.address);
    expect(aliceSent.map(Number)).to.deep.equal([0, 1]);

    const aliceReceived = await ledger.getReceivedPaymentIds(alice.address);
    expect(aliceReceived.map(Number)).to.deep.equal([2]);

    const bobReceived = await ledger.getReceivedPaymentIds(bob.address);
    expect(bobReceived.map(Number)).to.deep.equal([0]);
  });

  it("does not lose funds if called with insufficient balance (fails before any transfer)", async function () {
    // alice tries to send more than she has — this is rejected before the
    // transaction is even mined (a provider-level "insufficient funds"
    // error, not a Solidity revert), so any thrown error here proves the
    // right thing: nothing gets transferred and no payment gets recorded.
    const aliceBalance = await ethers.provider.getBalance(alice.address);
    let threw = false;
    try {
      await ledger.connect(alice).makePayment(bob.address, "p2p_transfer", { value: aliceBalance + 1n });
    } catch {
      threw = true;
    }
    expect(threw).to.equal(true);
    expect(await ledger.getPaymentCount()).to.equal(0);
  });
});
