import RiceType from "../models/RiceType.js";
import Stock from "../models/Stock.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const listRiceTypes = asyncHandler(async (req, res) => {
  const { includeInactive } = req.query;
  const filter = includeInactive ? {} : { active: true };
  const types = await RiceType.find(filter).sort({ name: 1 });
  res.json(types);
});

export const createRiceType = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: "Rice type name is required" });
  const exists = await RiceType.findOne({ name: new RegExp(`^${name.trim()}$`, "i") });
  if (exists) return res.status(400).json({ message: "This rice type already exists" });
  const type = await RiceType.create({ name: name.trim() });
  // Pre-create stock rows for both bori sizes so admin can stock them immediately
  await Stock.create({ riceType: type._id, boriSize: 25, quantity: 0 });
  await Stock.create({ riceType: type._id, boriSize: 50, quantity: 0 });
  res.status(201).json(type);
});

export const updateRiceType = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, active } = req.body;
  const type = await RiceType.findById(id);
  if (!type) return res.status(404).json({ message: "Rice type not found" });
  if (name) type.name = name.trim();
  if (typeof active === "boolean") type.active = active;
  await type.save();
  res.json(type);
});
