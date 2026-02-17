import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js";

// Routes
import authRoutes from "./routes/authRoutes.js";
import mentorshipRoutes from "./routes/mentorshipRoutes.js";
import mentorRoutes from "./routes/mentorRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";
import messageRoutes from "./routes/messageRoutes.js";
import resourceRoutes from "./routes/resourceRoutes.js";
import studenthistoryroutes from "./routes/studenthistoryroutes.js";

// Load environment variables
dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

// Use client URL from .env or fallback
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:5173";

//Apply CORS early
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
}));
app.use(express.json());

//Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: CLIENT_URL,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

const onlineUsers = new Map();

//Expose io and onlineUsers to routes via middleware
app.use((req, res, next) => {
  req.io = io;
  req.onlineUsers = onlineUsers;
  next();
});

// 🔌 Socket connection logic
io.on("connection", (socket) => {
  console.log(" New socket connected:", socket.id);

  socket.on("join", (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} joined with socket ${socket.id}`);
  });

  socket.on("sendMessage", ({ sender, receiver, text }) => {
    const receiverSocketId = onlineUsers.get(receiver);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receiveMessage", { sender, text });

      // Send notification
      io.to(receiverSocketId).emit("new_Notification", {
        type: "chat",
        from: sender,
        text: "You received a new message",
      });
    }
  });

  socket.on("disconnect", () => {
    for (let [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
    console.log("❌ Socket disconnected:", socket.id);
  });
});

// 🔗 Test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

// 🛣️ API routes
app.use("/api/auth", authRoutes);
app.use("/api/mentorship", mentorshipRoutes);
app.use("/api/mentors", mentorRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/resources", resourceRoutes);
app.use("/api/history", studenthistoryroutes);

// 🚀 Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
