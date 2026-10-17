import express from "express";
import { listChangeLog } from "../controllers/changeLogController.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/", listChangeLog);

export default router;
