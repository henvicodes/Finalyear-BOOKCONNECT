const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { protect, authorize } = require("../middleware/authMiddleware");
const { REGISTRATION_TYPES, HINTS, normaliseRegistration, isHttpUrl } = require("../utils/registration");

const clean = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

// GET /api/publisher-verification/mine -> the publisher's own verification state
router.get("/mine", protect, authorize("publisher"), async (req, res) => {
  const v = req.user.publisherVerification || {};
  res.json({
    success: true,
    data: {
      status: v.status || (v.isVerified ? "approved" : "none"),
      isVerified: !!v.isVerified,
      companyName: v.companyName,
      websiteUrl: v.websiteUrl,
      registrationType: v.registrationType,
      registrationNumber: v.registrationNumber,
      documentLink: v.documentLink,
      notes: v.notes,
      submittedAt: v.submittedAt,
      reviewedAt: v.reviewedAt,
      rejectionReason: v.rejectionReason,
      blockchainHash: v.blockchainHash,
    },
    registrationTypes: REGISTRATION_TYPES.map((type) => ({ type, hint: HINTS[type] })),
  });
});

// POST /api/publisher-verification -> submit evidence for an admin to review
router.post("/", protect, authorize("publisher"), async (req, res) => {
  try {
    const current = req.user.publisherVerification || {};
    if (current.isVerified || current.status === "approved") {
      return res.status(400).json({ success: false, message: "You are already verified." });
    }
    if (current.status === "pending") {
      return res.status(400).json({ success: false, message: "Your request is already waiting for review." });
    }

    const companyName = clean(req.body.companyName, 120);
    const websiteUrl = clean(req.body.websiteUrl, 300);
    const documentLink = clean(req.body.documentLink, 500);
    const notes = clean(req.body.notes, 1000);
    const registrationType = req.body.registrationType;

    if (companyName.length < 2) {
      return res.status(400).json({ success: false, message: "Enter your company / imprint name." });
    }
    if (!REGISTRATION_TYPES.includes(registrationType)) {
      return res.status(400).json({ success: false, message: "Choose a registration type." });
    }
    const registrationNumber = normaliseRegistration(registrationType, req.body.registrationNumber);
    if (!registrationNumber) {
      return res.status(400).json({
        success: false,
        message: `That ${registrationType.replace("_", " ")} doesn't look valid (${HINTS[registrationType]}).`,
      });
    }
    if (!isHttpUrl(documentLink)) {
      return res.status(400).json({ success: false, message: "Add a link to your registration document (a shareable https link)." });
    }
    if (websiteUrl && !isHttpUrl(websiteUrl)) {
      return res.status(400).json({ success: false, message: "The website must be a valid http(s) link." });
    }

    await User.updateOne(
      { _id: req.user._id },
      {
        $set: {
          "publisherVerification.status": "pending",
          "publisherVerification.isVerified": false,
          "publisherVerification.companyName": companyName,
          "publisherVerification.websiteUrl": websiteUrl,
          "publisherVerification.registrationType": registrationType,
          "publisherVerification.registrationNumber": registrationNumber,
          "publisherVerification.documentLink": documentLink,
          "publisherVerification.notes": notes,
          "publisherVerification.submittedAt": new Date(),
        },
        $unset: {
          "publisherVerification.rejectionReason": "",
          "publisherVerification.reviewedAt": "",
          "publisherVerification.reviewedBy": "",
          "publisherVerification.blockchainHash": "",
        },
      }
    );

    res.status(201).json({ success: true, message: "Sent for review. An admin will check your details." });
  } catch (error) {
    console.error("Publisher verification submit error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
