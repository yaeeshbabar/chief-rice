import express from "express";
import { listCustomers, createCustomer, getCustomer, updateCustomer } from "../controllers/customerController.js";
import { listPaymentsForCustomer, createPayment } from "../controllers/paymentController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listCustomers);
router.post("/", createCustomer);
router.get("/:id", getCustomer);
router.patch("/:id", updateCustomer);
router.get("/:id/payments", listPaymentsForCustomer);
router.post("/:id/payments", createPayment);

export default router;
