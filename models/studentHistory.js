import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    code:  { type: String, default: "" },
    name:  { type: String, default: "" },
    marks: { type: String, default: "" },
  },
  { _id: false }
);

const semesterSchema = new mongoose.Schema(
  {
    semesterNumber: { type: Number, required: true, min: 1, max: 8 },
    gpa:            { type: String, default: "" },
    subjects:       { type: [subjectSchema], default: [] },
  },
  { _id: false }
);

const schoolingSchema = new mongoose.Schema(
  {
    highSchoolName:            { type: String, default: "" },
    highSchoolPercentage:      { type: String, default: "" },
    higherSecondaryName:       { type: String, default: "" },
    higherSecondaryPercentage: { type: String, default: "" },
  },
  { _id: false }
);

const guardianSchema = new mongoose.Schema(
  {
    fatherName:         { type: String, default: "" },
    fatherOccupation:   { type: String, default: "" },
    fatherPhoto:        { type: String, default: "" }, // Base64
    fatherAadhaar:      { type: String, default: "" },
    fatherLicense:      { type: String, default: "" },
    fatherAnnualIncome: { type: String, default: "" },
    motherName:         { type: String, default: "" },
    motherOccupation:   { type: String, default: "" },
    motherPhoto:        { type: String, default: "" }, // Base64
    motherAadhaar:      { type: String, default: "" },
    motherLicense:      { type: String, default: "" },
    motherAnnualIncome: { type: String, default: "" },
  },
  { _id: false }
);

const studentHistorySchema = new mongoose.Schema(
  {
    // ── FIX: matches your project's actual model filename ──────────────────────
    student: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
      unique:   true,
    },

    // 01 // IDENTITY
    fullName:         { type: String, default: "" },
    regNo:            { type: String, default: "" },
    phoneNumber:      { type: String, default: "" },
    dob:              { type: Date },
    department:       { type: String, default: "" },
    permanentAddress: { type: String, default: "" },
    bloodGroup:       { type: String, default: "" },
    aadhaarNo:        { type: String, default: "" },
    admissionNo:      { type: String, default: "" },
    licenseNo:        { type: String, default: "" },
    studentPhoto:     { type: String, default: "" }, // Base64

    // 02 // GUARDIANS
    guardians: { type: guardianSchema, default: () => ({}) },

    // 03 // SCHOOLING
    schooling: { type: schoolingSchema, default: () => ({}) },

    // 04 // PROFESSIONAL ASSETS
    skills:            { type: [String], default: [] },
    newAchievement:    { type: String, default: "" },
    certificationLink: { type: String, default: "" },

    // 05 // ACADEMIC LEDGER
    semesters: {
      type:     [semesterSchema],
      default:  [],
      validate: {
        validator: (arr) => arr.length <= 8,
        message:   "Maximum 8 semesters allowed.",
      },
    },

    // Audit trail
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
    },
  },
  { timestamps: true }
);

studentHistorySchema.index({ student: 1 });

const StudentHistory = mongoose.model("StudentHistory", studentHistorySchema);
export default StudentHistory;