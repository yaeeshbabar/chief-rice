import express from "express";
import { createHandover, listHandovers } from "../controllers/cashHandoverController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listHandovers);
router.post("/", createHandover);

export default router;
