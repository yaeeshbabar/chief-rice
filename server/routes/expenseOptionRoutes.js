import express from "express";
import {
  listExpenseOptions,
  createExpenseOption,
  updateExpenseOption,
} from "../controllers/expenseOptionController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listExpenseOptions);
router.post("/", requireRole("admin"), createExpenseOption);
router.patch("/:id", requireRole("admin"), updateExpenseOption);

export default router;
