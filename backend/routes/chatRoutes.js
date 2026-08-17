const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Virtual AI Bot ID for seamless AI Assistant Chat
const AI_BOT_ID = "0000000000000000000000aa";
const AI_BOT_USER = {
  _id: AI_BOT_ID,
  name: "BookConnect AI Assistant",
  email: "ai@bookconnect.com",
  role: "ai_bot",
  profilePicture: "",
  isAi: true
};

// 1. GET /api/messages/conversations -> Get active message threads for current user
router.get("/conversations", protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // Find all messages involving the user that are NOT deleted for this user
    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
      deletedBy: { $ne: userId }
    })
      .populate("sender", "name email profilePicture role")
      .populate("receiver", "name email profilePicture role")
      .sort({ createdAt: -1 });

    const conversationMap = new Map();

    for (const msg of messages) {
      const isSender = msg.sender && msg.sender._id.toString() === userId.toString();
      const partner = isSender ? msg.receiver : msg.sender;

      if (!partner) continue;
      const partnerId = partner._id.toString();

      if (!conversationMap.has(partnerId)) {
        let displayContent = msg.content;
        if (msg.deletedForEveryone) {
          displayContent = "This message was deleted";
        }

        conversationMap.set(partnerId, {
          partner: {
            _id: partner._id,
            name: partner.name,
            email: partner.email,
            profilePicture: partner.profilePicture,
            role: partner.role
          },
          lastMessage: {
            _id: msg._id,
            content: displayContent,
            createdAt: msg.createdAt,
            senderId: msg.sender ? msg.sender._id : null,
            deletedForEveryone: msg.deletedForEveryone
          },
          unreadCount: (!isSender && !msg.read) ? 1 : 0
        });
      } else {
        const existing = conversationMap.get(partnerId);
        if (!isSender && !msg.read) {
          existing.unreadCount += 1;
        }
      }
    }

    const conversations = Array.from(conversationMap.values());

    // Check if AI Bot conversation exists or add AI Bot contact
    const hasAiConvo = conversations.some(c => c.partner._id.toString() === AI_BOT_ID);
    if (!hasAiConvo) {
      conversations.unshift({
        partner: AI_BOT_USER,
        lastMessage: {
          content: "Hello! I am your AI Assistant. Ask me anything about writing, manuscripts, or publishing!",
          createdAt: new Date()
        },
        unreadCount: 0
      });
    }

    res.json({ success: true, data: conversations });
  } catch (error) {
    console.error("Fetch conversations error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 2. GET /api/messages/:userId -> Load persistent chat history with a contact
router.get("/:userId", protect, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;

    // Special AI Bot chat history
    if (targetUserId === AI_BOT_ID) {
      const aiMessages = await Message.find({
        $or: [
          { sender: currentUserId, receiver: currentUserId, isAi: true },
          { sender: currentUserId, isAi: true }
        ],
        deletedBy: { $ne: currentUserId }
      }).sort("createdAt");

      // Map to include AI user info
      const formatted = aiMessages.map(m => ({
        ...m.toObject(),
        content: m.deletedForEveryone ? "This message was deleted" : m.content,
        sender: m.sender.toString() === currentUserId.toString() && !m.isSystem && m.content.startsWith("[AI Response]:") === false
          ? { _id: currentUserId, name: req.user.name, role: req.user.role }
          : AI_BOT_USER
      }));

      return res.json({ success: true, data: formatted });
    }

    const history = await Message.find({
      $or: [
        { sender: currentUserId, receiver: targetUserId },
        { sender: targetUserId, receiver: currentUserId }
      ],
      deletedBy: { $ne: currentUserId }
    })
      .populate("sender", "name email profilePicture role")
      .populate("receiver", "name email profilePicture role")
      .populate("book", "title status publishingCost")
      .sort("createdAt");

    // Mask deleted for everyone content
    const sanitizedHistory = history.map(msg => {
      const obj = msg.toObject();
      if (obj.deletedForEveryone) {
        obj.content = "This message was deleted";
      }
      return obj;
    });

    res.json({ success: true, data: sanitizedHistory });
  } catch (error) {
    console.error("Fetch chat history error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 3. POST /api/messages -> Send real message to another user
router.post("/", protect, async (req, res) => {
  try {
    const { receiverId, content, bookId, isSystem } = req.body;
    if (!receiverId || !content) {
      return res.status(400).json({ success: false, message: "Receiver and Content are required" });
    }

    // Handle sending to AI Bot directly if receiverId is AI_BOT_ID
    if (receiverId === AI_BOT_ID) {
      return handleAiMessage(req, res);
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

    // Emit Socket.io event for real-time delivery
    const io = req.app.get("io");
    if (io) {
      io.to(receiverId.toString()).emit("new_message", message);
      io.to(req.user._id.toString()).emit("message_sent", message);
    }

    res.status(201).json({ success: true, data: message });
  } catch (error) {
    console.error("Send message error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Helper: AI Chatbot message handler
async function handleAiMessage(req, res) {
  try {
    const { content } = req.body;
    const userId = req.user._id;

    // 1. Save user prompt
    const userMsg = await Message.create({
      sender: userId,
      receiver: userId,
      content,
      isAi: true
    });

    userMsg.sender = { _id: userId, name: req.user.name, role: req.user.role };
    userMsg.receiver = AI_BOT_USER;

    // 2. Generate AI response
    let aiText = "";
    if (process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(
          `You are BookConnect AI Assistant. Help the user with writing, publishing, manuscript reviews, or platform questions. User query: "${content}"`
        );
        aiText = result.response.text();
      } catch (geminiErr) {
        console.error("Gemini AI Chat error:", geminiErr);
      }
    }

    if (!aiText) {
      // Offline fallback AI response
      const lower = content.toLowerCase();
      if (lower.includes("publish") || lower.includes("cost") || lower.includes("fee")) {
        aiText = "Publishers on BookConnect review your uploaded manuscripts and propose publishing costs via direct chat. Once agreed, authors can fulfill the fee securely via Web3 escrow.";
      } else if (lower.includes("manuscript") || lower.includes("upload") || lower.includes("book")) {
        aiText = "You can upload new manuscripts from your Author Dashboard. Our system automatically runs AI readability checks and plagiarism scans on your content!";
      } else if (lower.includes("hello") || lower.includes("hi") || lower.includes("hey")) {
        aiText = `Hello ${req.user.name}! I am your BookConnect AI Assistant. How can I assist you with your books, manuscripts, or publishing today?`;
      } else {
        aiText = `Thank you for reaching out! Regarding "${content}": BookConnect offers AI quality analysis, manuscript negotiation with publishers, and reader recommendations. Let me know if you need specific help!`;
      }
    }

    // 3. Save AI response message
    const aiMsg = await Message.create({
      sender: userId,
      receiver: userId,
      content: aiText,
      isAi: true
    });

    aiMsg.sender = AI_BOT_USER;
    aiMsg.receiver = { _id: userId, name: req.user.name, role: req.user.role };

    res.status(201).json({
      success: true,
      data: userMsg,
      aiResponse: aiMsg
    });
  } catch (err) {
    console.error("AI Message error:", err);
    res.status(500).json({ success: false, message: "AI response failed" });
  }
}

// 4. POST /api/messages/ai -> Dedicated endpoint for AI Assistant chat
router.post("/ai", protect, handleAiMessage);

// 5. DELETE /api/messages/:messageId -> Delete message ("me" or "everyone")
router.delete("/:messageId", protect, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deleteType } = req.body; // 'everyone' or 'me'
    const userId = req.user._id;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ success: false, message: "Message not found" });
    }

    const io = req.app.get("io");

    if (deleteType === "everyone") {
      // Only sender can delete for everyone
      if (message.sender.toString() !== userId.toString()) {
        return res.status(403).json({ success: false, message: "Only the sender can delete a message for everyone" });
      }
      message.deletedForEveryone = true;
      message.content = "This message was deleted";
      await message.save();

      if (io) {
        io.to(message.sender.toString()).emit("message_deleted", { messageId, deleteType: "everyone" });
        io.to(message.receiver.toString()).emit("message_deleted", { messageId, deleteType: "everyone" });
      }
    } else {
      // Default: "delete for me"
      if (!message.deletedBy.includes(userId)) {
        message.deletedBy.push(userId);
        await message.save();
      }

      if (io) {
        io.to(userId.toString()).emit("message_deleted", { messageId, deleteType: "me" });
      }
    }

    res.json({ success: true, message: "Message deleted successfully", data: message });
  } catch (error) {
    console.error("Delete message error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 6. DELETE /api/messages/conversation/:userId -> Clear entire conversation history for current user
router.delete("/conversation/:userId", protect, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;

    if (targetUserId === AI_BOT_ID) {
      await Message.updateMany(
        { sender: currentUserId, isAi: true },
        { $addToSet: { deletedBy: currentUserId } }
      );
    } else {
      await Message.updateMany(
        {
          $or: [
            { sender: currentUserId, receiver: targetUserId },
            { sender: targetUserId, receiver: currentUserId }
          ]
        },
        { $addToSet: { deletedBy: currentUserId } }
      );
    }

    res.json({ success: true, message: "Conversation cleared successfully" });
  } catch (error) {
    console.error("Clear conversation error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// 7. PUT /api/messages/read/:userId -> Mark messages from partner as read
router.put("/read/:userId", protect, async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const targetUserId = req.params.userId;

    await Message.updateMany(
      { sender: targetUserId, receiver: currentUserId, read: false },
      { $set: { read: true } }
    );

    res.json({ success: true, message: "Messages marked as read" });
  } catch (error) {
    console.error("Mark read error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
