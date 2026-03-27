// backend/routes/studenthistoryroutes.js
import express from "express";
import {
  getStudentHistory,
  createStudentHistory,
  updateStudentHistory,
  deleteStudentHistory,
  upsertSemester,
  getAllStudentHistories,
} from "../controllers/studenthistorycontroller.js";
import { protect, roleGuard } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Apply protection to ALL routes in this file
router.use(protect);

/**
 * @description Admin/Mentor only: Fetch all records
 */
router.get("/all", roleGuard("mentor"), getAllStudentHistories);

/**
 * @description Standard Student/Mentor CRUD
 * Mentors can pass ?studentId in the body or params depending on your controller logic
 */
router
  .route("/")
  .get(roleGuard("student", "mentor"), getStudentHistory)
  .post(roleGuard("student", "mentor"), createStudentHistory)
  .put(roleGuard("student", "mentor"), updateStudentHistory)
  .delete(roleGuard("student", "mentor"), deleteStudentHistory);

router.patch("/semester", roleGuard("student", "mentor"), upsertSemester);

/**
 * @description Explicit Mentor-only routes for specific student IDs
 * Note: Ensure your controller checks for req.params.studentId
 */
router
  .route("/:studentId")
  .get(roleGuard("mentor"), getStudentHistory)
  .post(roleGuard("mentor"), createStudentHistory)
  .put(roleGuard("mentor"), updateStudentHistory)
  .delete(roleGuard("mentor"), deleteStudentHistory);

router.patch("/:studentId/semester", roleGuard("mentor"), upsertSemester);

export default router;