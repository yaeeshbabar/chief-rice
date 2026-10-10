import express from "express";
import { listAllPayments } from "../controllers/paymentController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listAllPayments);

export default router;
