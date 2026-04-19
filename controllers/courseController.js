import Course from "../models/courseModel.js";
import MentorshipRequest from "../models/mentorshipModel.js";
import cloudinary from "../config/cloudinary.js";
import https from "https";
import http from "http";
import crypto from "crypto";

// ── helper: upload buffer to Cloudinary ──────────────────────────────────────
const uploadToCloud = (buffer, opts) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(opts, (err, res) =>
      err ? reject(err) : resolve(res)
    );
    stream.end(buffer);
  });

// ── helper: derive public_id from a stored Cloudinary URL ────────────────────
// For RAW resources the public_id INCLUDES the file extension.
// e.g. https://res.cloudinary.com/<cloud>/raw/upload/v123/mentor_courses/abc.pdf
//   => mentor_courses/abc.pdf
// For IMAGE resources the URL also includes the extension in the path.
const publicIdFromUrl = (url) => {
  try {
    const parts    = new URL(url).pathname.split("/");
    const uploadIdx = parts.indexOf("upload");
    if (uploadIdx === -1) return null;
    let rest = parts.slice(uploadIdx + 1);
    // skip version segment like v1776536062
    if (/^v\d+$/.test(rest[0])) rest = rest.slice(1);
    return rest.join("/");
  } catch {
    return null;
  }
};

// ── helper: pipe a remote URL to an Express response (follows redirects) ─────
const pipeUrl = (url, expRes, hops = 0) =>
  new Promise((resolve, reject) => {
    if (hops > 5) return reject(new Error("Too many redirects"));
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (upstream) => {
      if (upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
        upstream.resume();
        return pipeUrl(upstream.headers.location, expRes, hops + 1).then(resolve).catch(reject);
      }
      if (upstream.statusCode !== 200) {
        upstream.resume();
        return reject(new Error(`Remote HTTP ${upstream.statusCode}`));
      }
      upstream.pipe(expRes);
      upstream.on("end", resolve);
      upstream.on("error", reject);
    }).on("error", reject);
  });

// ── helper: build a Cloudinary signed download URL for RAW resources ─────────
// Implements the same HMAC-SHA1 signing that the Cloudinary SDK uses internally,
// so we don't depend on private_download_url which varies across SDK versions.
const buildRawSignedUrl = (publicId, attachment = false) => {
  const cloud   = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey  = process.env.CLOUDINARY_API_KEY;
  const secret  = process.env.CLOUDINARY_API_SECRET;

  const timestamp = Math.floor(Date.now() / 1000);
  const expiresAt = timestamp + 300; // valid for 5 minutes

  // Params that go into the signature (mirrors Cloudinary SDK _build_upload_params)
  const sigParams = { expires_at: expiresAt, public_id: publicId, timestamp };
  if (attachment) sigParams.attachment = "true";

  // Sort keys, join as key=value&key=value, append raw api_secret, SHA-1
  const toSign =
    Object.keys(sigParams)
      .sort()
      .map((k) => `${k}=${sigParams[k]}`)
      .join("&") + secret;

  const signature = crypto.createHash("sha1").update(toSign).digest("hex");

  const qs = new URLSearchParams({
    public_id:  publicId,
    api_key:    apiKey,
    timestamp,
    expires_at: expiresAt,
    signature,
    ...(attachment ? { attachment: "true" } : {}),
  });

  return `https://api.cloudinary.com/v1_1/${cloud}/raw/download?${qs}`;
};

// ── MENTOR: Add a course (video or PDF) ──────────────────────────────────────
//
// Key design decision for PDFs:
//   • resource_type "image" — Cloudinary accepts PDFs here and the resulting URL
//     is publicly accessible (no 401) unlike resource_type "raw".
//   • This means students can view/download without any backend proxy.
export const addCourse = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File is required" });

    const { title, description, type } = req.body;
    if (!title || !type) return res.status(400).json({ message: "Title and type are required" });

    const isPdf = type === "pdf";

    const uploadOpts = {
      folder:        "mentor_courses",
      // PDFs as "image" → public delivery URL, no auth required.
      // Videos/other as "auto" → Cloudinary picks the right type.
      resource_type: isPdf ? "image" : "auto",
    };

    const result = await uploadToCloud(req.file.buffer, uploadOpts);

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

// ── SHARED: Serve a PDF — view inline or force download ──────────────────────
// GET /api/courses/:id/pdf-stream?disposition=inline|attachment
//
// Two strategies based on how the PDF was stored in Cloudinary:
//
//  A) IMAGE type (new uploads after this fix):
//     The Cloudinary URL is publicly accessible.
//     → For inline:     pipe the URL directly (correct Content-Type header)
//     → For download:   insert fl_attachment into the URL then pipe
//
//  B) RAW type (old uploads):
//     Direct URL returns 401. We build a self-signed admin-API download URL
//     using HMAC-SHA1 (same algorithm the Cloudinary SDK uses internally)
//     and pipe THAT — it authenticates via URL params, not headers.
export const streamPdf = async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    if (course.type !== "pdf") return res.status(400).json({ message: "Not a PDF" });

    const disposition = req.query.disposition === "attachment" ? "attachment" : "inline";
    const filename    = encodeURIComponent((course.title || "document") + ".pdf");

    // Detect storage type: image (new) vs raw (legacy)
    const isImageType =
      (course.resourceType && course.resourceType.startsWith("image")) ||
      course.fileUrl.includes("/image/upload/");

    let targetUrl;

    if (isImageType) {
      // ── Strategy A: image-type PDF ──────────────────────────────────────────
      if (disposition === "attachment") {
        // Insert fl_attachment transformation flag
        targetUrl = course.fileUrl.replace("/upload/", "/upload/fl_attachment/");
      } else {
        targetUrl = course.fileUrl;
      }
    } else {
      // ── Strategy B: legacy raw-type PDF ─────────────────────────────────────
      const publicId = course.publicId || publicIdFromUrl(course.fileUrl);
      if (!publicId) {
        console.error("[streamPdf] Cannot resolve public_id from:", course.fileUrl);
        return res.status(500).json({ message: "Cannot resolve PDF public_id" });
      }
      targetUrl = buildRawSignedUrl(publicId, disposition === "attachment");
    }

    console.log(`[streamPdf] type=${isImageType ? "image" : "raw"} disposition=${disposition}`);
    console.log(`[streamPdf] url=${targetUrl.split("?")[0]}`);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${disposition}; filename="${filename}"`);
    res.setHeader("Access-Control-Allow-Origin", process.env.CLIENT_URL || "*");
    res.setHeader("Access-Control-Expose-Headers", "Content-Disposition");

    await pipeUrl(targetUrl, res);
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
