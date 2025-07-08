import Message from "../models/messageModel.js";

//Get all messages between two users
export const getMessages = async (req, res) => {
  const { userId } = req.params;
  const currentUserId = req.user._id;

  try {
    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ]
    }).sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

//Save a new message
export const saveMessage = async (req, res) => {
  const { receiver, text } = req.body;

  try {
    const message = await Message.create({
      sender: req.user._id,
      receiver,
      text
    });

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get recent contacts (only unique, last-contacted ones)
export const getRecentContacts = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    })
      .sort({ createdAt: -1 }) // most recent first
      .populate("sender", "name avatar")
      .populate("receiver", "name avatar");

    const contactsMap = new Map();

    for (const msg of messages) {
      // Skip message if sender or receiver is null (possible if user was deleted)
      if (!msg.sender || !msg.receiver) continue;

      const otherUser =
        msg.sender._id.toString() === userId
          ? msg.receiver
          : msg.sender;

      // Skip if still null (extra safety)
      if (!otherUser || !otherUser._id) continue;

      if (!contactsMap.has(otherUser._id.toString())) {
        contactsMap.set(otherUser._id.toString(), otherUser);
      }
    }

    const recentContacts = Array.from(contactsMap.values());
    res.status(200).json(recentContacts);
  } catch (err) {
    console.error("getRecentContacts error:", err);
    res.status(500).json({ message: "Failed to fetch recent contacts" });
  }
};