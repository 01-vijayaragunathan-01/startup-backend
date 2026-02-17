import express from "express";
import {
  getStudentHistory,
  createStudentHistory,
  updateStudentHistory,
  deleteStudentHistory,
  upsertSemester,
  getAllStudentHistories,
} from "../controllers/studenthistorycontroller.js";
import { protect, roleGuard } from "../middleware/authMiddleware.js";

const router = express.Router();

// All routes require a valid JWT
router.use(protect);

// ─────────────────────────────────────────────────────────────────────────────
// Routes accessible by BOTH students and mentors
// (student always operates on their own record;
//  mentor supplies :studentId in the URL)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET  /api/student-history
 * @desc    Student: fetch own history
 * @access  student | mentor (own record path)
 */
router.get("/", roleGuard("student", "mentor"), getStudentHistory);

/**
 * @route   POST /api/student-history
 * @desc    Student: create own history record
 * @access  student | mentor
 */
router.post("/", roleGuard("student", "mentor"), createStudentHistory);

/**
 * @route   PUT  /api/student-history
 * @desc    Student: update own history record (partial updates supported)
 * @access  student | mentor
 */
router.put("/", roleGuard("student", "mentor"), updateStudentHistory);

/**
 * @route   DELETE /api/student-history
 * @desc    Student: delete own history record
 * @access  student | mentor
 */
router.delete("/", roleGuard("student", "mentor"), deleteStudentHistory);

/**
 * @route   PATCH /api/student-history/semester
 * @desc    Student: add or update a single semester in their own record
 * @access  student | mentor
 */
router.patch("/semester", roleGuard("student", "mentor"), upsertSemester);

// ─────────────────────────────────────────────────────────────────────────────
// Mentor-only routes  (operate on any student by :studentId)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @route   GET  /api/student-history/all
 * @desc    Mentor: paginated list of ALL student history records
 * @access  mentor
 */
router.get("/all", roleGuard("mentor"), getAllStudentHistories);

/**
 * @route   GET  /api/student-history/:studentId
 * @desc    Mentor: fetch a specific student's history
 * @access  mentor
 */
router.get("/:studentId", roleGuard("mentor"), getStudentHistory);

/**
 * @route   POST /api/student-history/:studentId
 * @desc    Mentor: create a history record for a specific student
 * @access  mentor
 */
router.post("/:studentId", roleGuard("mentor"), createStudentHistory);

/**
 * @route   PUT  /api/student-history/:studentId
 * @desc    Mentor: update a specific student's history (partial updates supported)
 * @access  mentor
 */
router.put("/:studentId", roleGuard("mentor"), updateStudentHistory);

/**
 * @route   DELETE /api/student-history/:studentId
 * @desc    Mentor: delete a specific student's history record
 * @access  mentor
 */
router.delete("/:studentId", roleGuard("mentor"), deleteStudentHistory);

/**
 * @route   PATCH /api/student-history/:studentId/semester
 * @desc    Mentor: add or update a single semester for a specific student
 * @access  mentor
 */
router.patch("/:studentId/semester", roleGuard("mentor"), upsertSemester);

export default router;