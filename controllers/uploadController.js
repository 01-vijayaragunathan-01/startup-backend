// backend/controllers/uploadController.js
import cloudinary from "../config/cloudinary.js";

export const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const fileStr = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const uploadRes = await cloudinary.uploader.upload(fileStr, {
      folder: "mentorMeteeUploads",
    });

    res.status(200).json({ url: uploadRes.secure_url });
  } catch (err) {
    console.error("Upload Error:", err);
    res.status(500).json({ message: "Upload failed" });
  }
};
