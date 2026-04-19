import express from "express";
import multer from "multer";
import {
  addCourse, updateCourse, deleteCourse,
  getMentorCourses, getStudentCourses, getPdfSignedUrl,
} from "../controllers/courseController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();
// Accept video (up to 200 MB) and PDF (up to 50 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 200 * 1024 * 1024 },
});

// MENTOR
router.post(   "/",    protect, upload.single("file"), addCourse);
router.put(    "/:id", protect, updateCourse);
router.delete( "/:id", protect, deleteCourse);
router.get(    "/my",  protect, getMentorCourses);

// STUDENT — courses from all connected mentors
router.get(    "/student", protect, getStudentCourses);

// SHARED — get a short-lived signed URL for a PDF (view or download)
// Must come before /:id to avoid route collision
router.get(    "/:id/signed-url", protect, getPdfSignedUrl);

export default router;
