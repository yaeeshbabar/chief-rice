import CommissionPayout from "../models/CommissionPayout.js";
import CommissionAgent from "../models/CommissionAgent.js";
import Sale from "../models/Sale.js";

// Earned / paid / still-owed commission for every agent, all time.
export const buildCommissionSummary = async () => {
  const [agents, sales, payouts] = await Promise.all([
    CommissionAgent.find().sort({ name: 1 }),
    Sale.find({ cancelled: false, commissionAmount: { $gt: 0 } }).select("commissionAmount commissionAgent"),
    CommissionPayout.find().select("agent amount"),
  ]);

  const earned = new Map();
  for (const s of sales) {
    const key = String(s.commissionAgent?._id || s.commissionAgent);
    earned.set(key, (earned.get(key) || 0) + s.commissionAmount);
  }
  const paid = new Map();
  for (const p of payouts) {
    const key = String(p.agent);
    paid.set(key, (paid.get(key) || 0) + p.amount);
  }

  const rows = agents
    .map((a) => {
      const e = earned.get(String(a._id)) || 0;
      const p = paid.get(String(a._id)) || 0;
      return {
        agentId: a._id,
        name: a.name,
        percentage: a.percentage,
        active: a.active,
        deleted: Boolean(a.deleted),
        earned: e,
        paid: p,
        due: e - p,
      };
    })
    // hide agents that are inactive and fully settled; deleted ones only while something is owed
    .filter((r) => (r.deleted ? Math.abs(r.due) >= 1 : r.active || r.earned > 0 || r.paid > 0));

  const totalEarned = rows.reduce((sum, r) => sum + r.earned, 0);
  const totalPaid = rows.reduce((sum, r) => sum + r.paid, 0);
  // Money that must stay set aside - an overpaid agent (negative due) never reduces the reserve of others.
  const totalReserved = rows.reduce((sum, r) => sum + Math.max(0, r.due), 0);
  return { agents: rows, totalEarned, totalPaid, totalReserved };
};

