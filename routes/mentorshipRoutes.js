import express from "express";
import {
  createRequest,
  getMentorRequests,
  getStudentRequests,
  respondToRequest,
} from "../controllers/mentorshipController.js";


import { protect } from "../middlewares/authMiddleware.js";

const router = express.Router();

// STUDENT → Sends request to mentor
router.post("/request", protect, createRequest);

// MENTOR → Views all incoming requests
router.get("/requests", protect, getMentorRequests);

// STUDENT → Views all requests sent by self
router.get("/my-requests", protect, getStudentRequests);

// MENTOR → Accept or Reject a specific request
router.put("/respond/:id", protect, respondToRequest);

export default router;
