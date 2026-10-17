import { buildDateRangeFilter } from "../utils/dateRange.js";
import { computeCashPools } from "../utils/cashPools.js";
import { buildCommissionSummary } from "../utils/commissionSummary.js";
import CommissionPayout from "../models/CommissionPayout.js";
import CommissionAgent from "../models/CommissionAgent.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logChange, rs, requireReason } from "../utils/changeLog.js";

export const commissionSummary = asyncHandler(async (req, res) => {
  res.json(await buildCommissionSummary());
});

export const createCommissionPayout = asyncHandler(async (req, res) => {
  const { agentId, amount, note } = req.body;
  if (!agentId) return res.status(400).json({ message: "Select which salesman this commission is for" });
  if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "Enter a valid amount" });

  const agent = await CommissionAgent.findById(agentId);
  if (!agent) return res.status(404).json({ message: "Commission salesman not found" });

  const summary = await buildCommissionSummary();
  const row = summary.agents.find((r) => String(r.agentId) === String(agent._id));
  const due = row ? row.due : 0;
  if (Number(amount) > due) {
    return res.status(400).json({
      message: `${agent.name} is only owed Rs ${Math.round(due).toLocaleString()} - cannot hand over Rs ${Number(amount).toLocaleString()}.`,
    });
  }

  // The handover comes out of the cash counter, so the counter must actually have it.
  const pools = await computeCashPools();
  if (Number(amount) > pools.cashInCounter) {
    return res.status(400).json({
      message: `Only Rs ${Math.round(pools.cashInCounter).toLocaleString()} is in the cash counter right now - not enough to hand over Rs ${Number(amount).toLocaleString()}.`,
    });
  }

  const payout = await CommissionPayout.create({
    agent: agent._id,
    agentName: agent.name,
    amount: Number(amount),
    note: note || "",
    createdBy: req.user._id,
  });
  const populated = await payout.populate("createdBy", "name role");
  res.status(201).json(populated);
});

export const listCommissionPayouts = asyncHandler(async (req, res) => {
  const { agentId } = req.query;
  const filter = {};
  const range = buildDateRangeFilter(req.query.from, req.query.to);
  if (range) filter.createdAt = range;
  if (agentId) filter.agent = agentId;
  const payouts = await CommissionPayout.find(filter).populate("createdBy", "name role").sort({ createdAt: -1 });
  const total = payouts.reduce((sum, p) => sum + p.amount, 0);
  res.json({ payouts, total });
});

// Undo a commission handover entered by mistake: the salesman is owed it again and the
// cash counts as back in the counter.
export const deleteCommissionPayout = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const payout = await CommissionPayout.findById(req.params.id);
  if (!payout) return res.status(404).json({ message: "Commission handover not found" });
  await payout.deleteOne();
  await logChange(req, {
    area: "commission",
    action: "undo",
    summary: `Commission handover of ${rs(payout.amount)} to ${payout.agentName} undone`,
    reason,
    before: payout.toObject(),
  });
  res.json({ message: "Commission handover undone" });
});
