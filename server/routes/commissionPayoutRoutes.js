import express from "express";
import {
  commissionSummary,
  createCommissionPayout,
  listCommissionPayouts,
  deleteCommissionPayout,
} from "../controllers/commissionPayoutController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listCommissionPayouts);
router.get("/summary", commissionSummary);
router.post("/", createCommissionPayout);
router.delete("/:id", deleteCommissionPayout);

export default router;
