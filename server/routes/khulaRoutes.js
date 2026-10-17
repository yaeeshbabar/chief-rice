import express from "express";
import {
  listKhulaBatches,
  openKhulaBatch,
  closeKhulaBatch,
  shortageReport,
  khulaSummary,
  addLooseRice,
  markTypeEmpty,
  undoKhulaBatch,
} from "../controllers/khulaController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listKhulaBatches);
router.get("/summary", khulaSummary);
router.get("/shortage-report", shortageReport);
router.post("/open", openKhulaBatch);
router.post("/add-loose", requireRole("admin"), addLooseRice);
router.post("/mark-empty", markTypeEmpty);
router.post("/:id/undo", undoKhulaBatch);
router.patch("/:id/close", closeKhulaBatch);

export default router;
