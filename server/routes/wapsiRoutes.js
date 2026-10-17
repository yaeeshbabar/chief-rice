import express from "express";
import { createWapsi, listWapsi, deleteWapsi } from "../controllers/wapsiController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listWapsi);
router.post("/", createWapsi);
router.delete("/:id", deleteWapsi);

export default router;
