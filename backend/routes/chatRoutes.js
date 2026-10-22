const express = require("express");
const router = express.Router();
const Message = require("../models/Message");
const User = require("../models/User");
const { protect } = require("../middleware/authMiddleware");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const Anthropic = require("@anthropic-ai/sdk");

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

      // Who wrote each message: the flag when present. Messages saved before the flag
      // existed were stored as question, answer, question, answer... so those alternate.
      let legacyIndex = 0;
      const formatted = aiMessages.map(m => {
        const fromAi = typeof m.fromAi === "boolean" ? m.fromAi : legacyIndex++ % 2 === 1;
        return {
          ...m.toObject(),
          content: m.deletedForEveryone ? "This message was deleted" : m.content,
          sender: fromAi ? AI_BOT_USER : { _id: currentUserId, name: req.user.name, role: req.user.role },
        };
      });

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
const ASSISTANT_PROMPT = (name, role) => `You are the BookConnect AI Assistant inside a digital publishing app.
BookConnect lets authors write and publish books, publishers review manuscripts and make offers (or decline them),
readers buy and read books, and everyone has an in-app wallet protected by a 4-digit PIN (MetaMask / Sepolia testnet is optional).
The user is ${name}, a ${role}. Be friendly, concrete and brief (under 120 words). Help with writing, publishing, reading
and how to use BookConnect. If you don't know something about the app, say so rather than guessing.`;

// Answers used when no AI key is configured: plain keyword rules, matched on whole words.
// Short words must match whole ("hi" must not match "history"); longer ones match as a word start ("thank" -> "thanks").
const has = (text, ...words) => words.some((w) => new RegExp(`\\b${w}${w.length <= 3 ? "\\b" : ""}`, "i").test(text));
function builtInAnswer(content, user) {
  const t = content.trim();
  if (has(t, "thank")) return "You're welcome! Ask me anything else about BookConnect.";
  if (has(t, "how are you", "how r u", "how do you do")) {
    return `I'm doing well, thanks ${user.name}! I'm running in basic mode right now (no AI key is set up), so I can answer questions about how BookConnect works. What would you like to know?`;
  }
  if (has(t, "hello", "hi", "hey", "good morning", "good evening")) {
    return `Hello ${user.name}! I'm the BookConnect assistant. Ask me about publishing a book, offers and fees, your wallet and PIN, or reading and buying books.`;
  }
  if (has(t, "decline", "reject", "offer", "publisher", "publishing fee", "fee", "cost")) {
    return "When you send a manuscript, the publisher reads it and either sends an offer (a publishing fee) or declines it. If you accept an offer you pay the fee from your wallet with your PIN and the book goes live. If it's declined, you can edit it and send it to another publisher.";
  }
  if (has(t, "upload", "manuscript", "write", "chapter", "draft")) {
    return "Authors can write chapters in the Author Dashboard (Upload Book or My Books > Edit), run the readability and similarity check, then either publish directly or submit the manuscript to a publisher.";
  }
  if (has(t, "wallet", "pin", "balance", "money", "pay", "buy", "purchase")) {
    return "Your wallet balance is hidden until you click the eye and enter your 4-digit PIN. The PIN is also needed for every payment. If you forget it, use 'Forgot or reset PIN' and confirm with your account password.";
  }
  if (has(t, "metamask", "blockchain", "crypto", "sepolia", "web3", "ethereum")) {
    return "MetaMask is optional. Link it from your Profile > Wallet to record payments on the Sepolia test blockchain, and authors can register a manuscript's fingerprint on-chain. Payments stay inside BookConnect if either person hasn't linked a wallet.";
  }
  if (has(t, "verify", "verification", "verified", "badge")) {
    return "Publishers can ask to be verified from the Verification tab: send your company name, a registration number (CIN, GSTIN, Udyam or an ISBN) and a document link. An admin checks it and adds a Verified badge that authors see.";
  }
  if (has(t, "translate", "translation", "language")) {
    return "While reading you can translate a chapter into another language with the Translate button. If the free translation limit is used up, an admin needs to add a Claude API key.";
  }
  if (has(t, "recommend", "suggest", "what should i read", "genre")) {
    return "The Matchmaker and Recommendations pages suggest books from your reading history, ratings and readers with similar taste. Rate a few books to make them better.";
  }
  if (has(t, "help", "what can you do", "feature")) {
    return "I can explain how to publish a book, how offers and fees work, how your wallet, PIN and MetaMask work, how verification works, and how to read, rate and translate books.";
  }
  return `I'm in basic mode (no AI key is set up), so I can only answer questions about using BookConnect, such as publishing, offers and fees, your wallet and PIN, MetaMask, verification, reading and translating. I couldn't match "${t.slice(0, 80)}". Try asking about one of those.`;
}

async function handleAiMessage(req, res) {
  try {
    const content = typeof req.body.content === "string" ? req.body.content.trim().slice(0, 2000) : "";
    if (!content) {
      return res.status(400).json({ success: false, message: "Write a message first." });
    }
    const userId = req.user._id;

    // recent turns, so a follow-up question makes sense
    const recent = await Message.find({ sender: userId, receiver: userId, isAi: true, deletedBy: { $ne: userId } })
      .sort("-createdAt")
      .limit(8)
      .select("content fromAi");

    // 1. Save user prompt
    const userMsg = await Message.create({
      sender: userId,
      receiver: userId,
      content,
      isAi: true,
      fromAi: false,
    });

    userMsg.sender = { _id: userId, name: req.user.name, role: req.user.role };
    userMsg.receiver = AI_BOT_USER;

    // 2. Generate AI response: Claude, then Gemini, then the built-in answers
    let aiText = "";
    if (process.env.CLAUDE_API_KEY) {
      try {
        const history = recent.reverse().filter((m) => typeof m.fromAi === "boolean")
          .map((m) => ({ role: m.fromAi ? "assistant" : "user", content: m.content }));
        // the API needs the conversation to start with the user and alternate
        const turns = [];
        for (const h of [...history, { role: "user", content }]) {
          if (turns.length === 0 && h.role !== "user") continue;
          if (turns.length && turns[turns.length - 1].role === h.role) turns[turns.length - 1].content += `\n${h.content}`;
          else turns.push(h);
        }
        const anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
        const reply = await anthropic.messages.create({
          model: "claude-3-5-haiku-latest",
          max_tokens: 400,
          system: ASSISTANT_PROMPT(req.user.name, req.user.role),
          messages: turns,
        });
        aiText = reply.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
      } catch (claudeErr) {
        console.error("Claude chat error:", claudeErr.message);
      }
    }
    if (!aiText && process.env.GEMINI_API_KEY) {
      try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(`${ASSISTANT_PROMPT(req.user.name, req.user.role)}\n\nUser: ${content}`);
        aiText = result.response.text();
      } catch (geminiErr) {
        console.error("Gemini AI Chat error:", geminiErr.message);
      }
    }
    if (!aiText) aiText = builtInAnswer(content, req.user);

    // 3. Save AI response message
    const aiMsg = await Message.create({
      sender: userId,
      receiver: userId,
      content: aiText,
      isAi: true,
      fromAi: true,
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
