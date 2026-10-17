import express from "express";
import { listRiceTypes, createRiceType, updateRiceType, deleteRiceType } from "../controllers/riceTypeController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listRiceTypes);
router.post("/", requireRole("admin"), createRiceType);
router.patch("/:id", requireRole("admin"), updateRiceType);
router.delete("/:id", requireRole("admin"), deleteRiceType);

export default router;
