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
    highSchoolName:       { type: String, default: "" }, // 10th
    highSchoolPercentage: { type: String, default: "" },
    higherSecondaryName:  { type: String, default: "" }, // 12th
    higherSecondaryPercentage: { type: String, default: "" },
  },
  { _id: false }
);

const guardianSchema = new mongoose.Schema(
  {
    fatherName:       { type: String, default: "" },
    fatherOccupation: { type: String, default: "" },
    motherName:       { type: String, default: "" },
    motherOccupation: { type: String, default: "" },
  },
  { _id: false }
);

// ─── Main Schema 

const studentHistorySchema = new mongoose.Schema(
  {
    // Reference to the User who owns this record
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
      required: true,
      unique: true, // one record per student
    },

    // 01 // IDENTITY
    fullName:         { type: String, default: "" },
    regNo:            { type: String, default: "" },
    phoneNumber:      { type: String, default: "" },
    dob:              { type: Date },
    department:       { type: String, default: "" },
    permanentAddress: { type: String, default: "" },

    // 02 // GUARDIANS
    guardians: { type: guardianSchema, default: () => ({}) },

    // 03 // SCHOOLING
    schooling: { type: schoolingSchema, default: () => ({}) },

    // 04 // PROFESSIONAL ASSETS
    skills:            { type: [String], default: [] },
    newAchievement:    { type: String, default: "" },
    certificationLink: { type: String, default: "" },

    // 05 // ACADEMIC LEDGER (semesters 1-8)
    semesters: {
      type: [semesterSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 8,
        message:   "Maximum 8 semesters allowed.",
      },
    },

    // Audit – which mentor last touched this record
    lastEditedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
    },
  },
  { timestamps: true }
);

// ─── Indexes ──────────────────────────────────────────────────────────────────
studentHistorySchema.index({ student: 1 });

const StudentHistory = mongoose.model("StudentHistory", studentHistorySchema);
export default StudentHistory;