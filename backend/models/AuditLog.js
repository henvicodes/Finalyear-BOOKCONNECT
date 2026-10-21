const mongoose = require("mongoose");

// Append-only record of what admins did (who, what, to whom, why).
const auditLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    action: { type: String, required: true }, // e.g. "user.suspend"
    targetType: { type: String, enum: ["user", "book", "publisher_verification"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    targetLabel: { type: String, maxlength: 200 }, // name/title at the time, so it still reads after deletion
    details: { type: String, maxlength: 600 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
