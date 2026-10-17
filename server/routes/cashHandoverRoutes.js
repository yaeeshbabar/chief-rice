import express from "express";
import { createHandover, listHandovers, deleteHandover } from "../controllers/cashHandoverController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listHandovers);
router.post("/", createHandover);
router.delete("/:id", deleteHandover);

export default router;
