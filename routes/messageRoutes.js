import express from "express";
import { getMessages, getRecentContacts, saveMessage } from "../controllers/messageController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/contacts/recent", protect, getRecentContacts);
router.get("/:userId", protect, getMessages);
router.post("/", protect, saveMessage);

export default router;
