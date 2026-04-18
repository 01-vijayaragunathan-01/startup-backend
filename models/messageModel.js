import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
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
    text:      { type: String, default: "" },
    imageUrl:  { type: String, default: "" },
    read:      { type: Boolean, default: false },           // ← unread tracking
    deletedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);
export default Message;
