import express from "express";
import User from "../models/userModel.js";

const router = express.Router();

// Get all mentors
router.get("/", async (req, res) => {
  try {
    const mentors = await User.find({ role: "mentor" }).select("-password");
    res.status(200).json(mentors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get a specific mentor by ID
router.get("/:id", async (req, res) => {
  try {
    const mentor = await User.findById(req.params.id).select("-password");

    if (!mentor || mentor.role !== "mentor") {
      return res.status(404).json({ message: "Mentor not found" });
    }

    res.status(200).json(mentor);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch mentor details" });
  }
});

export default router;
