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

// ── helper: extract public_id from a Cloudinary URL ──────────────────────────
// For RAW  resources the public_id INCLUDES the extension (e.g. mentor_courses/abc.pdf)
// For IMAGE resources Cloudinary puts the extension at the end of the path too
const publicIdFromUrl = (url) => {
  try {
    const parts     = new URL(url).pathname.split("/");
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;
    let rest = parts.slice(uploadIdx + 1);
    if (/^v\d+$/.test(rest[0])) rest = rest.slice(1); // strip version segment
    return rest.join("/");
  } catch {
    return null;
  }
};

// ── MENTOR: Add a course (video or PDF) ──────────────────────────────────────
// PDFs are uploaded as resource_type "image" → Cloudinary gives a PUBLIC URL.
// This avoids the 401 that "raw" types return on restricted accounts.
export const addCourse = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File is required" });

    const { title, description, type } = req.body;
    if (!title || !type) return res.status(400).json({ message: "Title and type are required" });

    const isPdf = type === "pdf";

    const result = await uploadToCloud(req.file.buffer, {
      folder:        "mentor_courses",
      resource_type: isPdf ? "image" : "auto",
    });

    const course = await Course.create({
      mentor:       req.user._id,
      title:        title.trim(),
      description:  description || "",
      type,
      fileUrl:      result.secure_url,
      publicId:     result.public_id,
      resourceType: isPdf ? "image" : (result.resource_type || "auto"),
      fileSize:     `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`,
    });

    res.status(201).json({ success: true, data: course });
  } catch (err) {
    console.error("addCourse error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ── SHARED: Return a pre-signed URL for PDF access ───────────────────────────
// GET /api/courses/:id/pdf-url?disposition=inline|attachment
//
// Returns JSON  { success: true, url: "https://..." }
// The frontend opens this URL with window.open() — no proxy, no piping.
//
// For IMAGE-type PDFs (new):  cloudinary.url() signed delivery URL (publicly accessible).
// For RAW-type PDFs (legacy): cloudinary.utils.api_sign_request() signed Admin-API download URL.
export const getPdfUrl = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (course.type !== "pdf") return res.status(400).json({ message: "Not a PDF" });

    const attachment = req.query.disposition === "attachment";

    // Detect whether it was uploaded as image or raw
    const isImageType =
      (course.resourceType && course.resourceType.startsWith("image")) ||
      course.fileUrl.includes("/image/upload/");

    const publicId = course.publicId || publicIdFromUrl(course.fileUrl);
    if (!publicId) return res.status(500).json({ message: "Cannot resolve public_id" });

    let url;

    if (isImageType) {
      // ── Image-type: signed delivery URL ───────────────────────────────────
      // Cloudinary image-type PDFs are publicly accessible.
      // Adding fl_attachment forces browser to save rather than display.
      const opts = {
        resource_type: "image",
        type:          "upload",
        sign_url:      true,
        secure:        true,
        expires_at:    Math.floor(Date.now() / 1000) + 300,
      };
      if (attachment) opts.flags = "attachment";
      url = cloudinary.url(publicId, opts);
    } else {
      // ── Raw-type (legacy): Admin-API private download URL ─────────────────
      // We build this using cloudinary.utils.api_sign_request which is
      // available in cloudinary@1.41.3 and computes the correct HMAC-SHA1.
      const ts        = Math.floor(Date.now() / 1000);
      const expiresAt = ts + 300;

      const sigParams = {
        expires_at: expiresAt,
        public_id:  publicId,
        timestamp:  ts,
        ...(attachment ? { attachment: "true" } : {}),
      };

      const signature = cloudinary.utils.api_sign_request(
        sigParams,
        process.env.CLOUDINARY_API_SECRET
      );

      const qs = new URLSearchParams({
        public_id:  publicId,
        api_key:    process.env.CLOUDINARY_API_KEY,
        timestamp:  ts,
        expires_at: expiresAt,
        signature,
        ...(attachment ? { attachment: "true" } : {}),
      });

      url = `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/raw/download?${qs}`;
    }

    console.log(`[getPdfUrl] isImageType=${isImageType} attachment=${attachment} publicId=${publicId}`);
    res.json({ success: true, url });
  } catch (err) {
    console.error("[getPdfUrl] error:", err.message);
    res.status(500).json({ message: err.message });
  }
};

// ── MENTOR: Edit course metadata ──────────────────────────────────────────────
export const updateCourse = async (req, res) => {
  try {
    const { id } = req.params;
    const course  = await Course.findById(id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (String(course.mentor) !== String(req.user._id))
      return res.status(403).json({ message: "Not authorised" });

    const { title, description } = req.body;
    if (title)                     course.title       = title.trim();
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
    const course  = await Course.findById(id);
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

// ── STUDENT: Get courses from connected mentors ───────────────────────────────
export const getStudentCourses = async (req, res) => {
  try {
    const connections = await MentorshipRequest.find({
      student: req.user._id,
      status:  "accepted",
    }).select("mentor");

    const mentorIds = connections.map((c) => c.mentor);
    if (mentorIds.length === 0)
      return res.json({ success: true, data: [], message: "No connected mentors yet." });

    const courses = await Course.find({ mentor: { $in: mentorIds } })
      .populate("mentor", "name avatar")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: courses });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
