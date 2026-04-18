import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  "User",
      required: true,
    },
    title:       { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    type:        { type: String, enum: ["video", "pdf"], required: true },
    fileUrl:     { type: String, required: true },   // Cloudinary secure URL
    thumbnailUrl:{ type: String, default: "" },      // optional video thumbnail
    duration:    { type: String, default: "" },      // e.g. "12:34"
    fileSize:    { type: String, default: "" },      // e.g. "4.2 MB"
  },
  { timestamps: true }
);

const Course = mongoose.model("Course", courseSchema);
export default Course;
