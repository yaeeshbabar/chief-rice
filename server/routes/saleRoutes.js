import express from "express";
import { createSale, listSales, getSale, updateSale, cancelSale, listChanges } from "../controllers/saleController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listSales);
router.get("/changes", listChanges);
router.post("/", createSale);
router.get("/:id", getSale);
router.patch("/:id", updateSale);
router.post("/:id/cancel", cancelSale);

export default router;
