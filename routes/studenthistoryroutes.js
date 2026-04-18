import express from "express";
import {
  getStudentHistory,
  createStudentHistory,
  updateStudentHistory,
  deleteStudentHistory,
  upsertSemester,
  getAllStudentHistories,
  getConnectedStudents,
} from "../controllers/studenthistorycontroller.js";
import { protect, roleGuard } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.use(protect);

// Mentor: get all connected students (for sidebar list in dashboard)
router.get("/connected-students", roleGuard("mentor"), getConnectedStudents);

// Mentor: all connected student histories (paginated)
router.get("/all", roleGuard("mentor"), getAllStudentHistories);

// Student / Mentor standard CRUD (student acts on own; mentor passes studentId in body)
router
  .route("/")
  .get(roleGuard("student", "mentor"), getStudentHistory)
  .post(roleGuard("student"), createStudentHistory)
  .put(roleGuard("student"), updateStudentHistory)
  .delete(roleGuard("student"), deleteStudentHistory);

router.patch("/semester", roleGuard("student", "mentor"), upsertSemester);

// Mentor: view a specific student's history (connection-guarded in controller)
router
  .route("/:studentId")
  .get(roleGuard("mentor"), getStudentHistory);

export default router;