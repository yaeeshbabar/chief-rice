import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorHandler.js";

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });

export const login = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }
  const user = await User.findOne({ username: username.toLowerCase().trim() });
  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: "Invalid username or password" });
  }
  const token = signToken(user);
  res.json({
    token,
    user: { id: user._id, username: user.username, name: user.name, role: user.role },
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

// Self-service password reset: no email on this system, so the "previous password"
// itself acts as the verification step.
export const resetPassword = asyncHandler(async (req, res) => {
  const { username, oldPassword, newPassword } = req.body;
  if (!username || !oldPassword || !newPassword) {
    return res.status(400).json({ message: "Username, current password and new password are required" });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ message: "New password should be at least 6 characters" });
  }
  const user = await User.findOne({ username: username.toLowerCase().trim() });
  if (!user || !(await user.comparePassword(oldPassword))) {
    return res.status(401).json({ message: "Username or current password is incorrect" });
  }
  user.password = newPassword;
  await user.save();
  res.json({ message: "Password updated successfully" });
});
