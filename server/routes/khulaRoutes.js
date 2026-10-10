import express from "express";
import { listKhulaBatches, openKhulaBatch, closeKhulaBatch, shortageReport } from "../controllers/khulaController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listKhulaBatches);
router.get("/shortage-report", shortageReport);
router.post("/open", openKhulaBatch);
router.patch("/:id/close", closeKhulaBatch);

export default router;
