import ChangeLog from "../models/ChangeLog.js";
import { buildDateRangeFilter } from "../utils/dateRange.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const listChangeLog = asyncHandler(async (req, res) => {
  const { area, from, to } = req.query;
  const filter = {};
  if (area) filter.area = area;
  const range = buildDateRangeFilter(from, to);
  if (range) filter.createdAt = range;
  const rows = await ChangeLog.find(filter).populate("createdBy", "name role").sort({ createdAt: -1 }).limit(500);
  res.json(rows);
});
