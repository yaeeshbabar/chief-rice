import CommissionAgent from "../models/CommissionAgent.js";
import Sale from "../models/Sale.js";
import { buildDateRangeFilter } from "../utils/dateRange.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const listCommissionAgents = asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;
  const filter = includeInactive ? {} : { active: true };
  const agents = await CommissionAgent.find(filter).sort({ name: 1 });
  res.json(agents);
});

export const createCommissionAgent = asyncHandler(async (req, res) => {
  const { name, percentage } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: "Name is required" });
  if (percentage === undefined || Number(percentage) < 0 || Number(percentage) > 100) {
    return res.status(400).json({ message: "Percentage must be between 0 and 100" });
  }
  const agent = await CommissionAgent.create({ name: name.trim(), percentage: Number(percentage) });
  res.status(201).json(agent);
});

export const updateCommissionAgent = asyncHandler(async (req, res) => {
  const agent = await CommissionAgent.findById(req.params.id);
  if (!agent) return res.status(404).json({ message: "Commission agent not found" });
  const { name, percentage, active } = req.body;
  if (name) agent.name = name.trim();
  if (percentage !== undefined) agent.percentage = Number(percentage);
  if (typeof active === "boolean") agent.active = active;
  await agent.save();
  res.json(agent);
});

// Ledger of commission earned by each agent, with a date filter.
export const commissionLedger = asyncHandler(async (req, res) => {
  const { from, to, agentId } = req.query;
  const filter = { cancelled: false, commissionAmount: { $gt: 0 } };
  const range = buildDateRangeFilter(from, to);
  if (range) filter.createdAt = range;
  if (agentId) filter.commissionAgent = agentId;

  const sales = await Sale.find(filter)
    .populate("commissionAgent", "name percentage")
    .populate("customer", "name")
    .sort({ createdAt: -1 });

  const totalCommission = sales.reduce((sum, s) => sum + s.commissionAmount, 0);
  res.json({ sales, totalCommission });
});
