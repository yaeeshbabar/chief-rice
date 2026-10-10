import express from "express";
import { login, me, resetPassword } from "../controllers/authController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.post("/login", login);
router.post("/reset-password", resetPassword);
router.get("/me", protect, me);

export default router;
