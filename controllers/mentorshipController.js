import MentorshipRequest from "../models/mentorshipModel.js";
import User from "../models/userModel.js";

// Student: Create mentorship request
export const createRequest = async (req, res) => {
  try {
    const { mentorId } = req.body;

    const existingRequest = await MentorshipRequest.findOne({
      student: req.user._id,
      mentor: mentorId,
    });

    if (existingRequest) {
      return res.status(400).json({ message: "Request already sent" });
    }

    const request = await MentorshipRequest.create({
      student: req.user._id,
      mentor: mentorId,
    });

    res.status(201).json(request);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Mentor: Get incoming mentorship requests
export const getMentorRequests = async (req, res) => {
  try {
    const requests = await MentorshipRequest.find({ mentor: req.user._id })
      .populate("student", "-password");

    res.status(200).json({ requests });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Student: Get all mentorship requests sent by current student
export const getStudentRequests = async (req, res) => {
  try {
    const requests = await MentorshipRequest.find({ student: req.user._id })
      .populate("mentor", "-password");

    res.status(200).json(requests);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Mentor: Accept or Reject a mentorship request
export const respondToRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // expected: 'accepted' or 'rejected'

    const request = await MentorshipRequest.findById(id);
    if (!request) return res.status(404).json({ message: "Request not found" });

    if (request.mentor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Not authorized to respond to this request" });
    }

    request.status = status;
    await request.save();

    // 🔔 Send real-time notification to student
    if (req.io && req.onlineUsers) {
      const studentSocketId = req.onlineUsers.get(request.student.toString());
      if (studentSocketId) {
        req.io.to(studentSocketId).emit("new_notification", {
          type: "mentorship",
          text: `🎓 Your mentorship request was ${status}`,
          from: request.mentor.toString(),
        });
      }
    }

    res.status(200).json({ message: `Request ${status}` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
