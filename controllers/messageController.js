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
    console.log("📥 Fetching recent contacts for:", userId);

    const messages = await Message.find({
      $or: [{ sender: userId }, { receiver: userId }],
    })
      .sort({ createdAt: -1 })
      .populate("sender", "name avatar")
      .populate("receiver", "name avatar");

    const contactsMap = new Map();

    for (const msg of messages) {
      const otherUser =
        msg.sender._id.toString() === userId
          ? msg.receiver
          : msg.sender;

      if (!otherUser || !otherUser.name) {
        console.log("⚠️ Skipping message due to missing user:", msg);
        continue;
      }

      if (!contactsMap.has(otherUser._id.toString())) {
        contactsMap.set(otherUser._id.toString(), otherUser);
      }
    }

    const recentContacts = Array.from(contactsMap.values());
    console.log("✅ Recent contacts:", recentContacts);
    res.status(200).json(recentContacts);
  } catch (err) {
    console.error("❌ Error in getRecentContacts:", err);
    res.status(500).json({ message: "Failed to fetch recent contacts" });
  }
};
