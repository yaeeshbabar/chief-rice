import ExpenseOption from "../models/ExpenseOption.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const listExpenseOptions = asyncHandler(async (req, res) => {
  const { type, includeInactive } = req.query;
  const filter = {};
  if (type) filter.type = type;
  if (!includeInactive) filter.active = true;
  const options = await ExpenseOption.find(filter).sort({ name: 1 });
  res.json(options);
});

export const createExpenseOption = asyncHandler(async (req, res) => {
  const { type, name } = req.body;
  if (!["salaryPerson", "rentType"].includes(type)) {
    return res.status(400).json({ message: "Invalid option type" });
  }
  if (!name || !name.trim()) return res.status(400).json({ message: "Name is required" });
  const exists = await ExpenseOption.findOne({ type, name: new RegExp(`^${name.trim()}$`, "i") });
  if (exists) return res.status(400).json({ message: "This option already exists" });
  const option = await ExpenseOption.create({ type, name: name.trim() });
  res.status(201).json(option);
});

export const updateExpenseOption = asyncHandler(async (req, res) => {
  const { active, name } = req.body;
  const option = await ExpenseOption.findById(req.params.id);
  if (!option) return res.status(404).json({ message: "Option not found" });
  if (typeof active === "boolean") option.active = active;
  if (name) option.name = name.trim();
  await option.save();
  res.json(option);
});
