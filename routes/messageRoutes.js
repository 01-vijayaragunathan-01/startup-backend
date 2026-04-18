import express from "express";
import multer from "multer";
import {
  getMessages,
  getRecentContacts,
  saveMessage,
  sendImageMessage,
  deleteMessage,
} from "../controllers/messageController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router  = express.Router();
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get("/contacts/recent",    protect,                        getRecentContacts);
router.get("/:userId",            protect,                        getMessages);
router.post("/",                  protect,                        saveMessage);
router.post("/image",             protect, upload.single("image"), sendImageMessage);
router.delete("/:messageId",      protect,                        deleteMessage);

export default router;
