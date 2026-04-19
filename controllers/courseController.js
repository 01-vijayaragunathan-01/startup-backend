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

// ── helper: extract raw public_id (no extension) from a Cloudinary URL ───────
//
// Cloudinary ALWAYS stores public_id WITHOUT the file extension, even for raw
// resources. The extension appears in the delivery URL but is NOT part of the
// stored identifier.
//
// Example:
//   URL  → https://res.cloudinary.com/<cloud>/raw/upload/v123/mentor_courses/abc.pdf
//   ID   → mentor_courses/abc          (extension stripped)
//
const publicIdFromUrl = (url) => {
  try {
    const parts     = new URL(url).pathname.split("/");
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;
    let rest = parts.slice(uploadIdx + 1);
    if (/^v\d+$/.test(rest[0])) rest = rest.slice(1); // remove version segment
    const full = rest.join("/");
    // Strip the file extension — Cloudinary stores without it
    return full.replace(/\.[^/.]+$/, "");
  } catch {
    return null;
  }
};

// ── MENTOR: Add a course ──────────────────────────────────────────────────────
// PDFs are stored as resource_type "image" on Cloudinary.
// When Cloudinary later delivers them, the signed URL uses format:"pdf".
export const addCourse = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File is required" });

    const { title, description, type } = req.body;
    if (!title || !type)
      return res.status(400).json({ message: "Title and type are required" });

    const isPdf = type === "pdf";

    const result = await uploadToCloud(req.file.buffer, {
      folder:        "mentor_courses",
      resource_type: isPdf ? "image" : "auto",
    });

    // Store the public_id WITHOUT extension (how Cloudinary internally indexes it)
    const storedPublicId = (result.public_id || "").replace(/\.[^/.]+$/, "");

    const course = await Course.create({
      mentor:       req.user._id,
      title:        title.trim(),
      description:  description || "",
      type,
      fileUrl:      result.secure_url,
      publicId:     storedPublicId,
      resourceType: isPdf ? "image" : (result.resource_type || "auto"),
      fileSize:     `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`,
    });

    res.status(201).json({ success: true, data: course });
  } catch (err) {
    console.error("addCourse error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ── SHARED: Return a signed Cloudinary URL for a PDF ─────────────────────────
// GET /api/courses/:id/pdf-url?disposition=inline|attachment
//
// Root causes of previous failures:
//
//  1. Raw PDFs  — We were sending public_id WITH ".pdf" extension.
//     Cloudinary stores the public_id WITHOUT the extension internally.
//     Admin download requires public_id WITHOUT extension + format="pdf".
//
//  2. Image PDFs — We were passing `expires_at` to cloudinary.url().
//     expires_at is only valid for type:"authenticated" resources.
//     For type:"upload" resources, sign_url:true must be used WITHOUT expires_at.
//
// Fix for both: use cloudinary.utils.private_download_url(cleanId, "pdf", ...)
//   which is the Admin-API download URL — always requires signature, always works
//   regardless of account delivery settings.
export const getPdfUrl = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (course.type !== "pdf") return res.status(400).json({ message: "Not a PDF" });

    const attachment = req.query.disposition === "attachment";

    // Resolve clean public_id (always WITHOUT extension)
    const rawId    = course.publicId || publicIdFromUrl(course.fileUrl);
    const publicId = rawId ? rawId.replace(/\.[^/.]+$/, "") : null;
    if (!publicId) return res.status(500).json({ message: "Cannot resolve public_id" });

    // Detect resource type: raw (legacy uploads) vs image (new uploads)
    const isImageType =
      (course.resourceType && course.resourceType.startsWith("image")) ||
      course.fileUrl.includes("/image/upload/");

    const resourceType = isImageType ? "image" : "raw";

    console.log(`[getPdfUrl] publicId="${publicId}" resourceType="${resourceType}" attachment=${attachment}`);

    // private_download_url generates a signed Admin-API URL:
    //   https://api.cloudinary.com/v1_1/{cloud}/{resourceType}/download
    //     ?public_id={id_without_ext}&format=pdf&signature=...&api_key=...&timestamp=...
    //
    // This works even when the Cloudinary account restricts delivery URLs (401).
    // It authenticates via HMAC-SHA1 signature — no Bearer token, no cookies.
    //
    // CRITICAL: Pass the public_id WITHOUT extension as first arg.
    //           Pass "pdf" as the format (second arg) — this is the extension.
    //           The SDK filters "" and undefined values, so format MUST be "pdf".
    const url = cloudinary.utils.private_download_url(publicId, "pdf", {
      resource_type: resourceType,
      type:          "upload",
      attachment:    attachment,
      expires_at:    Math.floor(Date.now() / 1000) + 300, // 5-minute window
    });

    console.log(`[getPdfUrl] url=${url.split("?")[0]}`);
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
