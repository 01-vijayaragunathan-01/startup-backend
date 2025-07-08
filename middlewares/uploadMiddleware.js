import multer from "multer";

const storage = multer.memoryStorage(); // Keep image in memory for Cloudinary
const upload = multer({ storage });

export default upload;
