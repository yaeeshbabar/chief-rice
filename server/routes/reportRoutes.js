import express from "express";
import {
  summary,
  salesTrend,
  stockOverview,
  khataOverview,
  cashInStore,
  salesReport,
  profitReport,
  asimMoney,
} from "../controllers/reportController.js";
import { protect, requireRole } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);
router.get("/summary", summary);
router.get("/sales-trend", salesTrend);
router.get("/stock-overview", stockOverview);
router.get("/khata-overview", khataOverview);
router.get("/cash-in-store", cashInStore);
router.get("/sales-report", salesReport);
router.get("/profit-report", profitReport);
router.get("/asim-money", requireRole("admin"), asimMoney);

export default router;
