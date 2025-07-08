import express from "express";
import {
  getResources,
  addResource,
  deleteResource,
} from "../controllers/resourceController.js";
import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Public: Get all resources
router.get("/", getResources);

// Protected: Add resource (only logged-in users)
router.post("/", protect, addResource);

// Protected: Delete a resource by ID
router.delete("/:id", protect, deleteResource);

export default router;
