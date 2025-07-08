import mongoose from "mongoose";

const mentorshipRequestSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  mentor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
}, { timestamps: true });

const MentorshipRequest = mongoose.model("MentorshipRequest", mentorshipRequestSchema);
export default MentorshipRequest;
