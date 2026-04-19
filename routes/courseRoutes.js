import express from "express";
import multer  from "multer";
import {
  addCourse, updateCourse, deleteCourse,
  getMentorCourses, getStudentCourses, getPdfUrl,
} from "../controllers/courseController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 200 * 1024 * 1024 }, // 200 MB max
});

// MENTOR
router.post(   "/",            protect, upload.single("file"), addCourse);
router.put(    "/:id",         protect, updateCourse);
router.delete( "/:id",         protect, deleteCourse);
router.get(    "/my",          protect, getMentorCourses);

// STUDENT — courses from all connected mentors
router.get(    "/student",     protect, getStudentCourses);

// SHARED — get a signed Cloudinary URL for a PDF (no streaming/proxy)
// Must be declared AFTER /my and /student to avoid those being treated as :id
router.get(    "/:id/pdf-url", protect, getPdfUrl);

export default router;
