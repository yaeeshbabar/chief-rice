import express from "express";
import { listStock, addStock, listTransactions } from "../controllers/stockController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listStock);
router.get("/transactions", listTransactions);
router.post("/add", requireRole("admin"), addStock);

export default router;
