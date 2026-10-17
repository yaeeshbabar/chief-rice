import express from "express";
import { listBankAccounts, createBankAccount, updateBankAccount, deleteBankAccount } from "../controllers/bankAccountController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listBankAccounts);
router.post("/", requireRole("admin"), createBankAccount);
router.patch("/:id", requireRole("admin"), updateBankAccount);
router.delete("/:id", requireRole("admin"), deleteBankAccount);

export default router;
