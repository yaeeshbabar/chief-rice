import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logChange } from "../utils/changeLog.js";

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
  if (user.active === false) return res.status(401).json({ message: "This login is turned off. Ask the admin." });
  const token = signToken(user);
  res.json({
    token,
    user: { id: user._id, username: user.username, name: user.name, role: user.role },
  });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user });
});

// Admin only: the logins of the app (no passwords).
export const listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select("username name role passwordChangedAt active").sort({ role: 1, name: 1 });
  res.json(users);
});

// Admin only: add a login, e.g. for a new salesman.
export const createUser = asyncHandler(async (req, res) => {
  const { name, password } = req.body;
  const username = String(req.body.username || "").toLowerCase().trim();
  const role = req.body.role === "admin" ? "admin" : "salesman";
  if (!name || !String(name).trim()) return res.status(400).json({ message: "Name is required" });
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) {
    return res.status(400).json({ message: "Username: 3 to 30 letters or numbers, no spaces" });
  }
  if (!password || String(password).length < 6) return res.status(400).json({ message: "Password should be at least 6 characters" });
  if (await User.exists({ username })) return res.status(400).json({ message: "This username is already taken" });
  const user = await User.create({ name: String(name).trim(), username, password: String(password), role });
  await logChange(req, { area: "settings", action: "add", summary: `Login added: ${user.name} (${user.username}, ${user.role})` });
  res.status(201).json({ _id: user._id, name: user.name, username: user.username, role: user.role, active: user.active });
});

// Admin only: change a login's name, or turn it off / on. A login that is turned off can't
// sign in and is logged out everywhere, but every record keeps showing the person's name.
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "Login not found" });
  const { name, active } = req.body;
  const parts = [];
  if (name !== undefined) {
    if (!String(name).trim()) return res.status(400).json({ message: "Name is required" });
    if (String(name).trim() !== user.name) {
      parts.push(`name "${user.name}" → "${String(name).trim()}"`);
      user.name = String(name).trim();
    }
  }
  if (typeof active === "boolean" && active !== (user.active !== false)) {
    if (!active && String(user._id) === String(req.user._id)) {
      return res.status(400).json({ message: "You can't turn off your own login" });
    }
    if (!active && user.role === "admin") {
      const otherAdmins = await User.countDocuments({ role: "admin", _id: { $ne: user._id }, active: { $ne: false } });
      if (!otherAdmins) return res.status(400).json({ message: "At least one admin login must stay on" });
    }
    user.active = active;
    parts.push(active ? "turned on" : "turned off");
  }
  await user.save();
  if (parts.length) {
    await logChange(req, {
      area: "settings",
      action: parts.length === 1 && typeof active === "boolean" ? (active ? "turn-on" : "turn-off") : "edit",
      summary: `Login ${user.username}: ${parts.join(", ")}`,
      reason: req.body.reason ? String(req.body.reason).trim() : "",
    });
  }
  res.json({ _id: user._id, name: user.name, username: user.username, role: user.role, active: user.active !== false });
});

// Admin only: set a new password for any login, e.g. when the salesman forgets his password
// or leaves the job. The admin confirms with their own current password. Every device that
// was logged in with the old password is signed out.
export const setUserPassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || String(newPassword).length < 6) {
    return res.status(400).json({ message: "New password should be at least 6 characters" });
  }
  const admin = await User.findById(req.user._id);
  if (!admin || !currentPassword || !(await admin.comparePassword(currentPassword))) {
    return res.status(400).json({ message: "Your current password is not correct" });
  }
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ message: "Login not found" });
  user.password = String(newPassword);
  await user.save();
  await logChange(req, {
    area: "settings",
    action: "edit",
    summary: `Password changed for ${user.name} (${user.username}); old logins signed out`,
  });
  const self = String(user._id) === String(req.user._id);
  // The admin who changed their own password stays logged in on this device.
  res.json({ message: "Password changed", token: self ? signToken(user) : undefined });
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
  if (user.active === false) return res.status(401).json({ message: "This login is turned off. Ask the admin." });
  user.password = newPassword;
  await user.save();
  res.json({ message: "Password updated successfully. Other devices will need to log in again." });
});
