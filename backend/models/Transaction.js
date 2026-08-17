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
        return "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join("");
      }
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
