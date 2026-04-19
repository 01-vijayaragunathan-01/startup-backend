import Course from "../models/courseModel.js";
import MentorshipRequest from "../models/mentorshipModel.js";
import cloudinary from "../config/cloudinary.js";
import https from "https";
import http from "http";

// ── helper: upload buffer to Cloudinary ──────────────────────────────────────
const uploadToCloud = (buffer, opts) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(opts, (err, res) =>
      err ? reject(err) : resolve(res)
    );
    stream.end(buffer);
  });

// ── helper: derive public_id from a stored Cloudinary URL ────────────────────
// For RAW resources, the public_id INCLUDES the file extension (e.g. mentor_courses/abc.pdf)
// e.g. https://res.cloudinary.com/<cloud>/raw/upload/v123/mentor_courses/abc.pdf
//   => mentor_courses/abc.pdf   (keep extension for raw resources)
const publicIdFromUrl = (url) => {
  try {
    const parts = new URL(url).pathname.split("/");
    // parts: ['', '<cloud>', 'raw' | 'image' | 'video', 'upload', 'v123', ...rest]
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;
    // skip version segment (starts with 'v' followed by digits)
    let rest = parts.slice(uploadIdx + 1);
    if (/^v\d+$/.test(rest[0])) rest = rest.slice(1);
    // Keep extension — for raw resources the extension is part of the public_id
    return rest.join("/");
  } catch {
    return null;
  }
};

// ── helper: fetch remote URL and pipe to Express response (follows redirects) ─
const pipeRemoteUrl = (remoteUrl, expRes, hops = 0) =>
  new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error("Too many redirects"));
    const lib = remoteUrl.startsWith("https") ? https : http;
    lib.get(remoteUrl, (upstream) => {
      // Follow 3xx redirects
      if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
        upstream.resume();
        return pipeRemoteUrl(upstream.headers.location, expRes, hops + 1)
          .then(resolve).catch(reject);
      }
      if (upstream.statusCode !== 200) {
        upstream.resume();
        return reject(new Error(`Cloudinary returned HTTP ${upstream.statusCode}`));
      }
      upstream.pipe(expRes);
      upstream.on("end", resolve);
      upstream.on("error", reject);
    }).on("error", reject);
  });

// ── MENTOR: Add a course (video or PDF) ──────────────────────────────────────
export const addCourse = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File is required" });

    const { title, description, type } = req.body;
    if (!title || !type) return res.status(400).json({ message: "Title and type are required" });

    const isPdf = type === "pdf";

    // PDFs must be uploaded as resource_type "raw" — Cloudinary won't serve them
    // as "image". We store the public_id so we can generate signed URLs later.
    const uploadOpts = {
      folder:        "mentor_courses",
      resource_type: isPdf ? "raw" : "auto",
    };

    const result = await uploadToCloud(req.file.buffer, uploadOpts);

    const course = await Course.create({
      mentor:       req.user._id,
      title:        title.trim(),
      description:  description || "",
      type,
      fileUrl:      result.secure_url,
      publicId:     result.public_id,   // stored so we can sign URLs on demand
      resourceType: isPdf ? "raw" : (result.resource_type || "auto"),
      fileSize:     `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`,
    });

    res.status(201).json({ success: true, data: course });
  } catch (err) {
    console.error("addCourse error:", err);
    res.status(500).json({ message: err.message });
  }
};

// ── SHARED: Stream a PDF through the backend (proxy) ─────────────────────────
// GET /api/courses/:id/pdf-stream?disposition=inline|attachment
//
// Strategy:
//   1. Resolve the Cloudinary public_id (raw resources include .pdf extension)
//   2. Generate a private_download_url — this is the correct Cloudinary v1 API
//      for authenticated access to raw resources. Format MUST be "" (not "pdf")
//      because for raw resources the extension is already part of the public_id.
//   3. The backend fetches the admin-API URL (which carries a valid HMAC signature)
//      and pipes the bytes to the client — the browser never touches Cloudinary.
export const streamPdf = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (course.type !== "pdf") return res.status(400).json({ message: "Not a PDF" });

    // For raw resources the public_id INCLUDES the .pdf extension
    const publicId = course.publicId || publicIdFromUrl(course.fileUrl);
    if (!publicId) return res.status(500).json({ message: "Cannot determine public_id" });

    const disposition = req.query.disposition === "attachment" ? "attachment" : "inline";
    const filename    = encodeURIComponent((course.title || "document") + ".pdf");

    // private_download_url is the correct API for raw resource authenticated download.
    // IMPORTANT: format must be "" (empty), NOT "pdf".
    //   • For image resources: public_id has no ext, format is the file ext.
    //   • For raw resources: public_id ALREADY includes the ext (e.g. abc.pdf),
    //     so format must be empty otherwise Cloudinary can't find the resource.
    const downloadUrl = cloudinary.utils.private_download_url(publicId, "", {
      resource_type: "raw",
      attachment:    disposition === "attachment",
      expires_at:    Math.floor(Date.now() / 1000) + 300, // 5 min window
    });

    console.log("[streamPdf] publicId:", publicId);
    console.log("[streamPdf] downloadUrl:", downloadUrl.split("?")[0]); // log path only, not the signature

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    res.setHeader("Access-Control-Allow-Origin", process.env.CLIENT_URL || "*");

    await pipeRemoteUrl(downloadUrl, res);
  } catch (err) {
    console.error("[streamPdf] error:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ message: err.message });
    }
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
