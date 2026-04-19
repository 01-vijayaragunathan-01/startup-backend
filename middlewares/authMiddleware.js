import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

// 1. Protect Middleware (Ensures user is logged in)
export const protect = async (req, res, next) => {
  let token;

  // Primary: Bearer token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
  // Fallback: ?token= query param (used by window.open() for PDF streaming)
  else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ message: "Not authorized, no token" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) {
      return res.status(401).json({ message: "User not found" });
    }
    next();
  } catch (error) {
    return res.status(401).json({ message: "Not authorized, token failed" });
  }
};

// 2. RoleGuard Middleware (THE MISSING FUNCTION)
// This checks if the logged-in user has the right permissions (student or mentor)
export const roleGuard = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Access denied: Role '${req.user?.role || 'None'}' is not authorized` 
      });
    }
    next();
  };
};