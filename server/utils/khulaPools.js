import KhulaBatch from "../models/KhulaBatch.js";
import Stock from "../models/Stock.js";

// Purchase cost per KG of the rice in a khula batch.
// Opened bori use that bori's current purchase price; loose and returned rice store their own.
export const costPerKgOf = async (batch) => {
  if (batch.source === "LOOSE" || batch.source === "RETURN") return batch.costPerKg || 0;
  if (!batch.boriSize) return batch.costPerKg || 0;
  const stock = await Stock.findOne({ riceType: batch.riceType?._id || batch.riceType, boriSize: batch.boriSize });
  return stock ? (stock.lastPricePerBori || 0) / batch.boriSize : 0;
};

// Today's purchase cost per KG for a rice type, from its latest bori price.
export const currentCostPerKg = async (riceTypeId) => {
  const rows = await Stock.find({ riceType: riceTypeId });
  const priced = rows.filter((r) => r.lastPricePerBori > 0).sort((a, b) => a.boriSize - b.boriSize);
  if (!priced.length) return 0;
  return priced[0].lastPricePerBori / priced[0].boriSize;
};

// All loose rice per rice type: total left, what it started as, and the lots inside it.
export const buildKhulaPools = async () => {
  const batches = await KhulaBatch.find({ status: "ACTIVE" })
    .populate("riceType", "name deleted")
    .populate("openedBy", "name")
    .sort({ createdAt: 1 });

  const pools = new Map();
  for (const b of batches) {
    if (!b.riceType) continue;
    const key = String(b.riceType._id);
    if (!pools.has(key)) {
      pools.set(key, {
        riceType: { _id: b.riceType._id, name: b.riceType.name },
        remainingGrams: 0,
        capacityGrams: 0,
        costValue: 0,
        batches: [],
      });
    }
    const pool = pools.get(key);
    const perKg = await costPerKgOf(b);
    pool.remainingGrams += b.remainingGrams;
    // "Put in" counts lots that still have rice (old lots left at 0 don't make the container look emptier)
    if (b.remainingGrams > 0) pool.capacityGrams += b.totalGrams;
    pool.costValue += (b.remainingGrams / 1000) * perKg;
    pool.batches.push({
      _id: b._id,
      source: b.source || "BORI",
      boriSize: b.boriSize,
      totalGrams: b.totalGrams,
      remainingGrams: b.remainingGrams,
      openingShortGrams: b.openingShortGrams || 0,
      createdAt: b.createdAt,
      openedBy: b.openedBy?.name || "",
      note: b.note || "",
      untouched: b.remainingGrams === b.totalGrams,
    });
  }

  return [...pools.values()]
    .map((p) => ({
      ...p,
      avgCostPerKg: p.remainingGrams > 0 ? p.costValue / (p.remainingGrams / 1000) : 0,
    }))
    .sort((a, b) => a.riceType.name.localeCompare(b.riceType.name));
};

// Takes `grams` of a rice type from its khula, oldest lot first. Returns the lots used.
// Lots that reach zero are closed as finished. Throws if there isn't enough.
export const takeFromKhula = async (riceType, grams, userId) => {
  const batches = await KhulaBatch.find({ riceType: riceType._id, status: "ACTIVE" }).sort({ createdAt: 1 });
  const available = batches.reduce((sum, b) => sum + b.remainingGrams, 0);
  if (available < grams) {
    const kg = parseFloat((available / 1000).toFixed(3));
    throw Object.assign(new Error(`Only ${kg} KG of ${riceType.name} is left in khula`), { statusCode: 400 });
  }
  let need = grams;
  const allocations = [];
  for (const b of batches) {
    if (need <= 0) break;
    const take = Math.min(b.remainingGrams, need);
    if (take <= 0) continue;
    const costPerKg = await costPerKgOf(b);
    b.remainingGrams -= take;
    if (b.remainingGrams === 0) {
      b.status = "FINISHED";
      b.shortfallGrams = 0;
      b.closedAt = new Date();
      b.closedBy = userId;
    }
    await b.save();
    allocations.push({ batch: b._id, grams: take, costPerKg });
    need -= take;
  }
  return allocations;
};

// Puts grams back into the lots they were taken from (when a bill is edited or cancelled).
export const giveBackToKhula = async (allocations) => {
  for (const a of allocations) {
    const batch = await KhulaBatch.findById(a.batch);
    if (!batch) continue;
    // A closed lot was empty in real life, so only the rice coming back counts.
    const left = batch.status === "ACTIVE" ? batch.remainingGrams : 0;
    batch.remainingGrams = Math.min(batch.totalGrams, left + a.grams);
    batch.status = "ACTIVE";
    await batch.save();
  }
};
