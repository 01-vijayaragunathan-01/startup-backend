import Course from "../models/courseModel.js";
import MentorshipRequest from "../models/mentorshipModel.js";
import cloudinary from "../config/cloudinary.js";

// ── helper: upload buffer to Cloudinary ──────────────────────────────────────
const uploadToCloud = (buffer, opts) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(opts, (err, res) =>
      err ? reject(err) : resolve(res)
    );
    stream.end(buffer);
  });

// ── MENTOR: Add a course (video or PDF) ──────────────────────────────────────
export const addCourse = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File is required" });

    const { title, description, type } = req.body;
    if (!title || !type) return res.status(400).json({ message: "Title and type are required" });

    const isVideo = type === "video";
    const result  = await uploadToCloud(req.file.buffer, {
      folder:        "mentor_courses",
      resource_type: isVideo ? "video" : "raw",
      format:        isVideo ? undefined : "pdf",
    });

    const course = await Course.create({
      mentor:      req.user._id,
      title:       title.trim(),
      description: description || "",
      type,
      fileUrl:     result.secure_url,
      fileSize:    `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`,
    });

    res.status(201).json({ success: true, data: course });
  } catch (err) {
    console.error("addCourse error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ── MENTOR: Edit course metadata (not file) ───────────────────────────────────
export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (String(course.mentor) !== String(req.user._id))
      return res.status(403).json({ message: "Not authorised" });

    const { title, description } = req.body;
    if (title)       course.title       = title.trim();
    if (description !== undefined) course.description = description;
    await course.save();

    res.json({ success: true, data: course });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── MENTOR: Delete a course ───────────────────────────────────────────────────
export const deleteCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course = await Course.findById(id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (String(course.mentor) !== String(req.user._id))
      return res.status(403).json({ message: "Not authorised" });

    await Course.findByIdAndDelete(id);
    res.json({ success: true, message: "Course deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── MENTOR: Get own courses ───────────────────────────────────────────────────
export const getMentorCourses = async (req, res) => {
  try {
    const courses = await Course.find({ mentor: req.user._id }).sort({ createdAt: -1 });
    res.json({ success: true, data: courses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ── STUDENT: Get courses from ALL connected (accepted) mentors ────────────────
export const getStudentCourses = async (req, res) => {
  try {
    // Find all mentors the student is connected to
    const connections = await MentorshipRequest.find({
      student: req.user._id,
      status:  "accepted",
    }).select("mentor");

    const mentorIds = connections.map((c) => c.mentor);

    if (mentorIds.length === 0) {
      return res.json({ success: true, data: [], message: "No connected mentors yet." });
    }

    const courses = await Course.find({ mentor: { $in: mentorIds } })
      .populate("mentor", "name avatar")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: courses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
