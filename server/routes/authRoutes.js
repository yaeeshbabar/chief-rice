import express from "express";
import { login, me, resetPassword, listUsers, setUserPassword, createUser, updateUser } from "../controllers/authController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.post("/login", login);
router.post("/reset-password", resetPassword);
router.get("/me", protect, me);
router.get("/users", protect, requireRole("admin"), listUsers);
router.post("/users", protect, requireRole("admin"), createUser);
router.patch("/users/:id", protect, requireRole("admin"), updateUser);
router.patch("/users/:id/password", protect, requireRole("admin"), setUserPassword);

export default router;
