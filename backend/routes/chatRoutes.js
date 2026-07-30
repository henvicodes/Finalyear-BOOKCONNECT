const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");

// 1. GET /api/messages/:userId -> Load chat history with a contact
router.get("/:userId", protect, async (req, res) => {
  try {
    const history = await Message.find({
      $or: [
        { sender: req.user._id, receiver: req.params.userId },
        { sender: req.params.userId, receiver: req.user._id }
      ]
    })
      .populate("sender", "name email profilePicture role")
      .populate("receiver", "name email profilePicture role")
      .populate("book", "title status publishingCost")
      .sort("createdAt");

    res.json({ success: true, data: history });
  } catch (error) {
    console.error("Fetch chat history error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2. POST /api/messages -> Send message
router.post("/", protect, async (req, res) => {
  try {
    const { receiverId, content, bookId, isSystem } = req.body;
    if (!receiverId || !content) {
      return res.status(400).json({ success: false, message: "Receiver and Content are required" });
    }

    const message = await Message.create({
      sender: req.user._id,
      receiver: receiverId,
      book: bookId || null,
      content,
      isSystem: isSystem || false
    });

    await message.populate("sender", "name email profilePicture role");
    await message.populate("receiver", "name email profilePicture role");
    if (bookId) {
      await message.populate("book", "title status publishingCost");
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
