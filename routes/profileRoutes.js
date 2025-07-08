import express from "express";
import { updateProfile, getMyProfile, getUserById } from "../controllers/profileController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.put("/update", protect, updateProfile);
router.get("/me", protect, getMyProfile);
router.get("/user/:id", protect, getUserById);

export default router;
