import User from "../models/userModel.js";

// Update logged-in user's profile
export const updateProfile = async (req, res) => {
  const userId = req.user.id;
  const { name, about, expertise, avatar, banner } = req.body;

  try {
    const user = await User.findByIdAndUpdate(
      userId,
      { name, about, expertise, avatar, banner },
      { new: true }
    );
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get logged-in user's profile
export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user profile" });
  }
};

// NEW: Get any user's public profile by ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to fetch user" });
  }
};
