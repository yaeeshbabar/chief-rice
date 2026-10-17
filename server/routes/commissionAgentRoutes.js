import express from "express";
import {
  listCommissionAgents,
  createCommissionAgent,
  updateCommissionAgent,
  commissionLedger,
  deleteCommissionAgent,
} from "../controllers/commissionAgentController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listCommissionAgents);
router.get("/ledger", commissionLedger);
router.post("/", requireRole("admin"), createCommissionAgent);
router.patch("/:id", requireRole("admin"), updateCommissionAgent);
router.delete("/:id", requireRole("admin"), deleteCommissionAgent);

export default router;
