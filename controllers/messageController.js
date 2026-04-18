import Message from "../models/messageModel.js";
import cloudinary from "../config/cloudinary.js";

// ── Get all messages between two users ──────────────────────────────────────
export const getMessages = async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  try {
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
      deletedBy: { $ne: currentUserId }, // exclude messages deleted by this user
    }).sort({ createdAt: 1 });

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
      sender: req.user._id,
      receiver,
      text: text || "",
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

    // Upload buffer to Cloudinary
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
    });

    res.status(201).json(message);
  } catch (err) {
    console.error("Image message error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ── Soft-delete a message for the requesting user ───────────────────────────
export const deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const userId = req.user._id;

  try {
    const message = await Message.findById(messageId);
    if (!message) return res.status(404).json({ message: "Message not found" });

    // Only sender or receiver can delete
    const isSender   = String(message.sender)   === String(userId);
    const isReceiver = String(message.receiver) === String(userId);
    if (!isSender && !isReceiver)
      return res.status(403).json({ message: "Not authorised to delete this message" });

    // Soft delete — add user to deletedBy[]
    if (!message.deletedBy.includes(userId)) {
      message.deletedBy.push(userId);
      await message.save();
    }

    res.json({ success: true, messageId });
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
