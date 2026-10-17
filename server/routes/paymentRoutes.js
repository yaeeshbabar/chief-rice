import express from "express";
import { listAllPayments, updatePayment, deletePayment } from "../controllers/paymentController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listAllPayments);
router.patch("/:id", updatePayment);
router.delete("/:id", deletePayment);

export default router;
