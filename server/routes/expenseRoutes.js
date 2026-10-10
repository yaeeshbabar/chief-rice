import express from "express";
import { createExpense, listExpenses, updateExpense, deleteExpense } from "../controllers/expenseController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listExpenses);
router.post("/", createExpense);
router.patch("/:id", updateExpense);
router.delete("/:id", requireRole("admin"), deleteExpense);

export default router;
