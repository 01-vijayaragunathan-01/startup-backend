import StudentHistory from "../models/studentHistory.js";
import User from "../models/User.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolves a target studentId from the request.
 *  - Student role: always their own id.
 *  - Mentor role: from req.params.studentId or req.body.studentId.
 */
const resolveStudentId = (req) => {
  if (req.user.role === "student") return req.user._id;
  return req.params.studentId || req.body.studentId;
};

/**
 * Verifies the student user actually exists and has the "student" role.
 */
const assertStudentExists = async (studentId) => {
  const student = await User.findById(studentId);
  if (!student || student.role !== "student") {
    throw Object.assign(new Error("Student not found."), { status: 404 });
  }
  return student;
};

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * GET /api/student-history/           → student fetches their own record
 * GET /api/student-history/:studentId → mentor fetches a specific student's record
 */
export const getStudentHistory = async (req, res) => {
  try {
    const studentId = resolveStudentId(req);

    await assertStudentExists(studentId);

    const record = await StudentHistory.findOne({ student: studentId })
      .populate("student", "name email role avatar")
      .populate("lastEditedBy", "name email role");

    if (!record) {
      return res.status(404).json({ message: "No history record found for this student." });
    }

    return res.status(200).json({ success: true, data: record });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

/**
 * POST /api/student-history/           → student creates their own record
 * POST /api/student-history/:studentId → mentor creates a record for a student
 *
 * Body: all StudentHistory fields (except student / lastEditedBy, those are set here)
 */
export const createStudentHistory = async (req, res) => {
  try {
    const studentId = resolveStudentId(req);

    await assertStudentExists(studentId);

    // Prevent duplicates
    const existing = await StudentHistory.findOne({ student: studentId });
    if (existing) {
      return res.status(409).json({
        message: "History record already exists. Use PUT to update it.",
      });
    }

    const {
      fullName, regNo, phoneNumber, dob, department, permanentAddress,
      guardians, schooling,
      skills, newAchievement, certificationLink,
      semesters,
    } = req.body;

    const record = await StudentHistory.create({
      student: studentId,
      lastEditedBy: req.user._id,
      fullName, regNo, phoneNumber, dob, department, permanentAddress,
      guardians, schooling,
      skills, newAchievement, certificationLink,
      semesters,
    });

    return res.status(201).json({ success: true, data: record });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(422).json({ message: err.message });
    }
    return res.status(err.status || 500).json({ message: err.message });
  }
};

/**
 * PUT /api/student-history/           → student updates their own record
 * PUT /api/student-history/:studentId → mentor updates a specific student's record
 *
 * Supports partial updates – only sends changed fields.
 * Semester logic: replaces the entire semesters array when provided, so the
 * client should always send the complete array (mirrors your frontend state).
 */
export const updateStudentHistory = async (req, res) => {
  try {
    const studentId = resolveStudentId(req);

    await assertStudentExists(studentId);

    const {
      fullName, regNo, phoneNumber, dob, department, permanentAddress,
      guardians, schooling,
      skills, newAchievement, certificationLink,
      semesters,
    } = req.body;

    // Build the update object – only include fields that were sent
    const updatePayload = { lastEditedBy: req.user._id };

    if (fullName         !== undefined) updatePayload.fullName         = fullName;
    if (regNo            !== undefined) updatePayload.regNo            = regNo;
    if (phoneNumber      !== undefined) updatePayload.phoneNumber      = phoneNumber;
    if (dob              !== undefined) updatePayload.dob              = dob;
    if (department       !== undefined) updatePayload.department       = department;
    if (permanentAddress !== undefined) updatePayload.permanentAddress = permanentAddress;
    if (guardians        !== undefined) updatePayload.guardians        = guardians;
    if (schooling        !== undefined) updatePayload.schooling        = schooling;
    if (skills           !== undefined) updatePayload.skills           = skills;
    if (newAchievement   !== undefined) updatePayload.newAchievement   = newAchievement;
    if (certificationLink !== undefined) updatePayload.certificationLink = certificationLink;
    if (semesters        !== undefined) {
      if (semesters.length > 8) {
        return res.status(422).json({ message: "Maximum 8 semesters allowed." });
      }
      updatePayload.semesters = semesters;
    }

    const record = await StudentHistory.findOneAndUpdate(
      { student: studentId },
      { $set: updatePayload },
      { new: true, runValidators: true }
    )
      .populate("student", "name email role avatar")
      .populate("lastEditedBy", "name email role");

    if (!record) {
      return res.status(404).json({
        message: "No history record found. Use POST to create one first.",
      });
    }

    return res.status(200).json({ success: true, data: record });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(422).json({ message: err.message });
    }
    return res.status(err.status || 500).json({ message: err.message });
  }
};

/**
 * DELETE /api/student-history/           → student deletes their own record
 * DELETE /api/student-history/:studentId → mentor deletes a student's record
 */
export const deleteStudentHistory = async (req, res) => {
  try {
    const studentId = resolveStudentId(req);

    const record = await StudentHistory.findOneAndDelete({ student: studentId });

    if (!record) {
      return res.status(404).json({ message: "No history record found." });
    }

    return res.status(200).json({ success: true, message: "Record deleted successfully." });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

// ─── Semester-level helpers (mentor or student) ───────────────────────────────

/**
 * PATCH /api/student-history/semester
 * PATCH /api/student-history/:studentId/semester
 *
 * Adds a new semester OR updates an existing one by semesterNumber.
 * Body: { semesterNumber, gpa, subjects }
 */
export const upsertSemester = async (req, res) => {
  try {
    const studentId = resolveStudentId(req);
    const { semesterNumber, gpa, subjects } = req.body;

    if (!semesterNumber || semesterNumber < 1 || semesterNumber > 8) {
      return res.status(422).json({ message: "semesterNumber must be between 1 and 8." });
    }

    // Check if this semester slot is already present
    const record = await StudentHistory.findOne({ student: studentId });
    if (!record) {
      return res.status(404).json({ message: "No history record found." });
    }

    const existingIndex = record.semesters.findIndex(
      (s) => s.semesterNumber === semesterNumber
    );

    if (existingIndex !== -1) {
      // Update in-place
      if (gpa      !== undefined) record.semesters[existingIndex].gpa      = gpa;
      if (subjects  !== undefined) record.semesters[existingIndex].subjects  = subjects;
    } else {
      if (record.semesters.length >= 8) {
        return res.status(422).json({ message: "Maximum 8 semesters already reached." });
      }
      record.semesters.push({ semesterNumber, gpa: gpa || "", subjects: subjects || [] });
      // Keep sorted
      record.semesters.sort((a, b) => a.semesterNumber - b.semesterNumber);
    }

    record.lastEditedBy = req.user._id;
    await record.save();

    return res.status(200).json({ success: true, data: record });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

/**
 * GET /api/student-history/all   → mentor-only: list all student history records
 * Supports pagination: ?page=1&limit=20
 */
export const getAllStudentHistories = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const skip  = (page - 1) * limit;

    const [records, total] = await Promise.all([
      StudentHistory.find()
        .populate("student",      "name email department avatar")
        .populate("lastEditedBy", "name email role")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit),
      StudentHistory.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      data: records,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
