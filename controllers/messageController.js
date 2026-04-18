import Message from "../models/messageModel.js";
import cloudinary from "../config/cloudinary.js";

// ── Get messages between two users (exclude soft-deleted) ───────────────────
export const getMessages = async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  try {
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
      deletedBy: { $ne: currentUserId },
    }).sort({ createdAt: 1 });

    // Auto-mark incoming messages as read
    await Message.updateMany(
      { sender: userId, receiver: currentUserId, read: false },
      { $set: { read: true } }
    );

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Save a new text message ──────────────────────────────────────────────────
export const saveMessage = async (req, res) => {
  const { receiver, text } = req.body;

  try {
    const message = await Message.create({
      sender:   req.user._id,
      receiver,
      text:     text || "",
      read:     false,
    });
    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Save a message with an image ─────────────────────────────────────────────
export const sendImageMessage = async (req, res) => {
  const { receiver } = req.body;

  try {
    if (!req.file) return res.status(400).json({ message: "No image provided" });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: "mentor_chat", resource_type: "image" },
        (error, result) => (error ? reject(error) : resolve(result))
      );
      stream.end(req.file.buffer);
    });

    const message = await Message.create({
      sender:   req.user._id,
      receiver,
      text:     "",
      imageUrl: result.secure_url,
      read:     false,
    });

    res.status(201).json(message);
  } catch (err) {
    console.error("Image message error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ── Soft-delete a message ────────────────────────────────────────────────────
export const deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  try {
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    const isSender   = String(message.sender)   === String(userId);
    const isReceiver = String(message.receiver) === String(userId);
    if (!isSender && !isReceiver)
      return res.status(403).json({ message: "Not authorised to delete this message" });

    if (!message.deletedBy.includes(userId)) {
      message.deletedBy.push(userId);
      await message.save();
    }

    res.json({ success: true, messageId });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Mark all messages from a sender as read ──────────────────────────────────
export const markAsRead = async (req, res) => {
  const { senderId } = req.params;
  const currentUserId = req.user._id;

  try {
    await Message.updateMany(
      { sender: senderId, receiver: currentUserId, read: false },
      { $set: { read: true } }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get unread message counts grouped by sender ──────────────────────────────
// Returns: { total: N, bySender: { senderId: count, ... } }
export const getUnreadCounts = async (req, res) => {
  const currentUserId = req.user._id;

  try {
    const unread = await Message.aggregate([
      {
        $match: {
          receiver: currentUserId,
          read:     false,
          deletedBy: { $ne: currentUserId },
        },
      },
      {
        $group: {
          _id:   "$sender",
          count: { $sum: 1 },
        },
      },
    ]);

    const bySender = {};
    let total = 0;
    for (const entry of unread) {
      bySender[entry._id.toString()] = entry.count;
      total += entry.count;
    }

    res.json({ total, bySender });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── Get recent contacts ──────────────────────────────────────────────────────
export const getRecentContacts = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    })
      .sort({ createdAt: -1 })
      .populate("sender",   "name avatar")
      .populate("receiver", "name avatar");

    const contactsMap = new Map();

    for (const msg of messages) {
      const otherUser =
        msg.sender?._id?.toString() === userId ? msg.receiver : msg.sender;

      if (!otherUser || !otherUser._id || !otherUser.name) continue;
      contactsMap.set(otherUser._id.toString(), otherUser);
    }

    res.status(200).json(Array.from(contactsMap.values()));
  } catch (err) {
    console.error("getRecentContacts error:", err);
    res.status(500).json({ message: "Failed to fetch recent contacts" });
  }
};
