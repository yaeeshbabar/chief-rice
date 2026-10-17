import express from "express";
import {
  listStock,
  addStock,
  listTransactions,
  updateStockEntry,
  deleteStockEntry,
  adjustStock,
} from "../controllers/stockController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listStock);
router.get("/transactions", listTransactions);
router.post("/add", requireRole("admin"), addStock);
router.post("/adjust", requireRole("admin"), adjustStock);
router.patch("/transactions/:id", requireRole("admin"), updateStockEntry);
router.delete("/transactions/:id", requireRole("admin"), deleteStockEntry);

export default router;
