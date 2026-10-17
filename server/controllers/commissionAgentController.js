import CommissionAgent from "../models/CommissionAgent.js";
import CommissionPayout from "../models/CommissionPayout.js";
import Sale from "../models/Sale.js";
import { buildCommissionSummary } from "../utils/commissionSummary.js";
import { buildDateRangeFilter } from "../utils/dateRange.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logChange, rs, requireReason } from "../utils/changeLog.js";

export const listCommissionAgents = asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;
  const filter = includeInactive ? { deleted: { $ne: true } } : { active: true, deleted: { $ne: true } };
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
  await logChange(req, { area: "settings", action: "add", summary: `Commission salesman ${agent.name} added (${agent.percentage}%)` });
  res.status(201).json(agent);
});

export const updateCommissionAgent = asyncHandler(async (req, res) => {
  const agent = await CommissionAgent.findById(req.params.id);
  if (!agent || agent.deleted) return res.status(404).json({ message: "Commission agent not found" });
  const { name, percentage, active } = req.body;
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ message: "Name is required" });
  if (percentage !== undefined && (!Number.isFinite(Number(percentage)) || Number(percentage) < 0 || Number(percentage) > 100)) {
    return res.status(400).json({ message: "Percentage must be between 0 and 100" });
  }

  const before = { name: agent.name, percentage: agent.percentage, active: agent.active };
  if (name) agent.name = name.trim();
  if (percentage !== undefined) agent.percentage = Number(percentage);
  if (typeof active === "boolean") agent.active = active;
  await agent.save();

  const parts = [];
  if (before.name !== agent.name) parts.push(`name "${before.name}" → "${agent.name}"`);
  if (before.percentage !== agent.percentage) parts.push(`commission ${before.percentage}% → ${agent.percentage}% (new bills only)`);
  if (before.active !== agent.active) parts.push(agent.active ? "turned on" : "turned off");
  if (parts.length) {
    await logChange(req, {
      area: "settings",
      action: parts.length === 1 && before.active !== agent.active ? (agent.active ? "turn-on" : "turn-off") : "edit",
      summary: `Commission salesman ${before.name}: ${parts.join(", ")}`,
      reason: req.body.reason ? String(req.body.reason).trim() : "",
      before,
      after: { name: agent.name, percentage: agent.percentage, active: agent.active },
    });
  }
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

// Admin only: delete a commission salesman. Not allowed while commission is still owed
// (hand it over first). If old bills point to them they are hidden, not erased.
export const deleteCommissionAgent = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const agent = await CommissionAgent.findById(req.params.id);
  if (!agent || agent.deleted) return res.status(404).json({ message: "Commission salesman not found" });
  const summary = await buildCommissionSummary();
  const row = summary.agents.find((r) => String(r.agentId) === String(agent._id));
  const due = row ? row.due : 0;
  if (due >= 1) {
    return res.status(400).json({ message: `${agent.name} is still owed ${rs(due)}. Hand it over first, then delete.` });
  }
  if (due <= -1) {
    return res.status(400).json({ message: `${agent.name} was paid ${rs(-due)} more than earned. Undo the extra handover first, then delete.` });
  }
  const [sales, payouts] = await Promise.all([
    Sale.exists({ commissionAgent: agent._id }),
    CommissionPayout.exists({ agent: agent._id }),
  ]);
  const used = Boolean(sales || payouts);
  if (used) {
    agent.deleted = true;
    agent.deletedAt = new Date();
    agent.active = false;
    await agent.save();
  } else {
    await agent.deleteOne();
  }
  await logChange(req, {
    area: "settings",
    action: "delete",
    summary: used ? `Commission salesman ${agent.name} deleted (old bills still show the name)` : `Commission salesman ${agent.name} deleted`,
    reason,
    before: { name: agent.name, percentage: agent.percentage },
  });
  res.json({ message: "Commission salesman deleted" });
});
