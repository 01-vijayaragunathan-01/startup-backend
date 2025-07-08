import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true,
      unique: true
    },
    password: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["student", "mentor"],
      default: "student"
    },
    about: { type: String },
    expertise: [String],
    avatar: { type: String },
    banner: { type: String },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
export default User;
