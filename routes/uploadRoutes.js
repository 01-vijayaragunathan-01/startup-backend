// backend/routes/uploadRoutes.js
import express from "express";
import upload from "../middlewares/uploadMiddleware.js";
import { uploadImage } from "../controllers/uploadController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/image", protect, upload.single("file"), uploadImage);

export default router;
