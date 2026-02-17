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

router.use(protect);

router.get("/all", roleGuard("mentor"), getAllStudentHistories);



// GET /api/student-history
router.get("/", roleGuard("student", "mentor"), getStudentHistory);

// POST /api/student-history
router.post("/", roleGuard("student", "mentor"), createStudentHistory);

// PUT /api/student-history
router.put("/", roleGuard("student", "mentor"), updateStudentHistory);

// DELETE /api/student-history
router.delete("/", roleGuard("student", "mentor"), deleteStudentHistory);

// PATCH /api/student-history/semester
router.patch("/semester", roleGuard("student", "mentor"), upsertSemester);

// ─── Mentor routes with :studentId 

// GET /api/student-history/:studentId
router.get("/:studentId", roleGuard("mentor"), getStudentHistory);

// POST /api/student-history/:studentId
router.post("/:studentId", roleGuard("mentor"), createStudentHistory);

// PUT /api/student-history/:studentId
router.put("/:studentId", roleGuard("mentor"), updateStudentHistory);

// DELETE /api/student-history/:studentId
router.delete("/:studentId", roleGuard("mentor"), deleteStudentHistory);

// PATCH /api/student-history/:studentId/semester
router.patch("/:studentId/semester", roleGuard("mentor"), upsertSemester);

export default router;