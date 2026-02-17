import StudentHistory from "../models/studentHistory.js";
import User from "../models/userModel.js"; 


const resolveStudentId = (req) => {
  if (req.user.role === "student") return req.user._id;
  return req.params.studentId || req.body.studentId;
};


const assertUserExists = async (userId) => {
  if (!userId) {
    throw Object.assign(new Error("Student ID is required."), { status: 400 });
  }
  const user = await User.findById(userId);
  if (!user) {
    throw Object.assign(new Error("User not found."), { status: 404 });
  }
  return user;
};

export const getStudentHistory = async (req, res) => {
  try {
    const studentId = resolveStudentId(req);
    await assertUserExists(studentId);

    const record = await StudentHistory.findOne({ student: studentId })
      .populate("student",      "name email role avatar")
      .populate("lastEditedBy", "name email role");

    if (!record) {
      return res.status(404).json({ message: "No history record found for this student." });
    }

    return res.status(200).json({ success: true, data: record });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};


export const createStudentHistory = async (req, res) => {
  try {
    const studentId = resolveStudentId(req);
    await assertUserExists(studentId);

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
      student:      studentId,
      lastEditedBy: req.user._id,
      fullName, regNo, phoneNumber, dob, department, permanentAddress,
      guardians, schooling,
      skills, newAchievement, certificationLink,
      semesters: semesters || [],
    });

    return res.status(201).json({ success: true, data: record });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res.status(422).json({ message: err.message });
    }
    return res.status(err.status || 500).json({ message: err.message });
  }
};


export const updateStudentHistory = async (req, res) => {
  try {
    const studentId = resolveStudentId(req);
    await assertUserExists(studentId);

    const {
      fullName, regNo, phoneNumber, dob, department, permanentAddress,
      guardians, schooling,
      skills, newAchievement, certificationLink,
      semesters,
    } = req.body;

    // Only set fields that were actually sent
    const updatePayload = { lastEditedBy: req.user._id };
    if (fullName          !== undefined) updatePayload.fullName          = fullName;
    if (regNo             !== undefined) updatePayload.regNo             = regNo;
    if (phoneNumber       !== undefined) updatePayload.phoneNumber       = phoneNumber;
    if (dob               !== undefined) updatePayload.dob               = dob;
    if (department        !== undefined) updatePayload.department        = department;
    if (permanentAddress  !== undefined) updatePayload.permanentAddress  = permanentAddress;
    if (guardians         !== undefined) updatePayload.guardians         = guardians;
    if (schooling         !== undefined) updatePayload.schooling         = schooling;
    if (skills            !== undefined) updatePayload.skills            = skills;
    if (newAchievement    !== undefined) updatePayload.newAchievement    = newAchievement;
    if (certificationLink !== undefined) updatePayload.certificationLink = certificationLink;
    if (semesters         !== undefined) {
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
      .populate("student",      "name email role avatar")
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

export const deleteStudentHistory = async (req, res) => {
  try {
    const studentId = resolveStudentId(req);
    const record    = await StudentHistory.findOneAndDelete({ student: studentId });

    if (!record) {
      return res.status(404).json({ message: "No history record found." });
    }

    return res.status(200).json({ success: true, message: "Record deleted successfully." });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};

export const upsertSemester = async (req, res) => {
  try {
    const studentId = resolveStudentId(req);
    const { semesterNumber, gpa, subjects } = req.body;

    if (!semesterNumber || semesterNumber < 1 || semesterNumber > 8) {
      return res.status(422).json({ message: "semesterNumber must be 1–8." });
    }

    const record = await StudentHistory.findOne({ student: studentId });
    if (!record) {
      return res.status(404).json({ message: "No history record found." });
    }

    const idx = record.semesters.findIndex((s) => s.semesterNumber === semesterNumber);

    if (idx !== -1) {
      if (gpa      !== undefined) record.semesters[idx].gpa      = gpa;
      if (subjects !== undefined) record.semesters[idx].subjects = subjects;
    } else {
      if (record.semesters.length >= 8) {
        return res.status(422).json({ message: "Maximum 8 semesters already reached." });
      }
      record.semesters.push({ semesterNumber, gpa: gpa || "", subjects: subjects || [] });
      record.semesters.sort((a, b) => a.semesterNumber - b.semesterNumber);
    }

    record.lastEditedBy = req.user._id;
    await record.save();

    return res.status(200).json({ success: true, data: record });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
};


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
      success:    true,
      pagination: { total, page, limit, pages: Math.ceil(total / limit) },
      data:       records,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};