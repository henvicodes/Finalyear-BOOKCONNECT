const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    txHash: {
      type: String,
      default: function() {
        // p2p_transfer records are only given a hash when a real one is
        // passed in (see onChain below) — book_purchase/publishing_fee
        // keep the legacy simulated-ledger placeholder hash.
        if (this.type === "p2p_transfer") return undefined;
        return "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join("");
      }
    },
    // True only when txHash is a real Sepolia transaction hash from the
    // PaymentLedger contract (the sender's own MetaMask signed it) — false
    // for off-chain-only platform transfers and the simulated ledger.
    onChain: {
      type: Boolean,
      default: false,
    },
    network: {
      type: String,
      default: undefined,
    },
    type: {
      type: String,
      enum: ["publishing_fee", "book_purchase", "p2p_transfer"],
      default: "p2p_transfer",
    },
    status: {
      type: String,
      enum: ["completed", "pending", "failed"],
      default: "completed",
    },
    note: {
      type: String,
      default: "",
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Transaction", transactionSchema);
