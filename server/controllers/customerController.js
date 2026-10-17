import Customer from "../models/Customer.js";
import Sale from "../models/Sale.js";
import Payment from "../models/Payment.js";
import Wapsi from "../models/Wapsi.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { logChange, rs, requireReason } from "../utils/changeLog.js";
import { escapeRegex } from "../utils/escapeRegex.js";

// Same number written differently (+92 300..., 0300-...) gives the same key: its last 10 digits.
const phoneKey = (phone) => String(phone || "").replace(/\D/g, "").slice(-10);

export const listCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = {};
  if (search && search.trim()) {
    const pattern = new RegExp(escapeRegex(search.trim()), "i");
    filter.$or = [{ name: pattern }, { shopName: pattern }, { phone: pattern }];
  }
  const customers = await Customer.find(filter).sort({ name: 1 });
  res.json(customers);
});

// Add a creditor without making a bill, e.g. to move the paper khata into the app.
// An old balance (money already owed from before) can be entered at the same time.
export const createCustomer = asyncHandler(async (req, res) => {
  const { name, shopName, phone, address, allowDuplicate } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: "Customer name is required" });
  const openingBalance = req.body.openingBalance === undefined || req.body.openingBalance === "" ? 0 : Number(req.body.openingBalance);
  if (!Number.isFinite(openingBalance) || openingBalance < 0) {
    return res.status(400).json({ message: "Old balance must be 0 or more" });
  }

  // Warn before making a second khata for the same person (same phone, or same name).
  if (!allowDuplicate) {
    const phoneDigits = phoneKey(phone);
    const sameName = await Customer.findOne({ name: new RegExp(`^${escapeRegex(name.trim())}$`, "i") });
    let samePhone = null;
    if (phoneDigits.length >= 7) {
      const candidates = await Customer.find({ phone: { $ne: "" } }).select("name shopName phone");
      samePhone = candidates.find((c) => phoneKey(c.phone) === phoneDigits) || null;
    }
    const existing = samePhone || sameName;
    if (existing) {
      return res.status(409).json({
        message: samePhone
          ? `${existing.name}${existing.shopName ? ` (${existing.shopName})` : ""} already has this phone number.`
          : `A customer named ${existing.name}${existing.shopName ? ` (${existing.shopName})` : ""} already exists.`,
        existingId: existing._id,
      });
    }
  }

  const customer = await Customer.create({
    name: name.trim(),
    shopName: shopName || "",
    phone: phone || "",
    address: address || "",
    balance: openingBalance,
    openingBalance,
    createdBy: req.user._id,
  });
  await logChange(req, {
    area: "customer",
    action: "add",
    summary:
      openingBalance > 0
        ? `Customer ${customer.name} added with old balance ${rs(openingBalance)}`
        : `Customer ${customer.name} added`,
    after: { name: customer.name, shopName: customer.shopName, phone: customer.phone, openingBalance },
  });
  res.status(201).json(customer);
});

export const getCustomer = asyncHandler(async (req, res) => {
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ message: "Customer not found" });
  const sales = await Sale.find({ customer: customer._id, cancelled: false })
    .populate("createdBy", "name")
    .sort({ createdAt: -1 });
  res.json({ customer, sales });
});

export const updateCustomer = asyncHandler(async (req, res) => {
  const { name, shopName, phone, address } = req.body;
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ message: "Customer not found" });
  if (name !== undefined && !String(name).trim()) return res.status(400).json({ message: "Name can't be empty" });

  // Old balance can be corrected (typed wrong when the customer was added). The khata
  // balance moves by the same difference, and a reason is required.
  let openingChange = null;
  if (req.body.openingBalance !== undefined && req.body.openingBalance !== "") {
    const next = Number(req.body.openingBalance);
    if (!Number.isFinite(next) || next < 0) return res.status(400).json({ message: "Old balance must be 0 or more" });
    const prev = customer.openingBalance || 0;
    if (next !== prev) {
      const reason = requireReason(req.body.reason);
      const newBalance = customer.balance + (next - prev);
      if (newBalance < 0) {
        return res.status(400).json({
          message: `${customer.name} has already paid ${rs(-newBalance)} more than that. Check the payments first.`,
        });
      }
      openingChange = { prev, next, reason, balanceBefore: customer.balance, balanceAfter: newBalance };
    }
  }

  const labels = { name: "name", shopName: "shop name", phone: "phone", address: "address" };
  const before = { name: customer.name, shopName: customer.shopName, phone: customer.phone, address: customer.address };
  if (name) customer.name = name.trim();
  if (shopName !== undefined) customer.shopName = shopName;
  if (phone !== undefined) customer.phone = phone;
  if (address !== undefined) customer.address = address;
  if (openingChange) {
    customer.openingBalance = openingChange.next;
    customer.balance = openingChange.balanceAfter;
  }
  await customer.save();

  const changed = Object.keys(labels).filter((k) => String(before[k] ?? "") !== String(customer[k] ?? ""));
  if (changed.length) {
    const parts = changed.map((k) => `${labels[k]} "${before[k] || "-"}" → "${customer[k] || "-"}"`);
    await logChange(req, {
      area: "customer",
      action: "edit",
      summary: `Customer ${before.name} details changed: ${parts.join(", ")}`,
      reason: req.body.reason ? String(req.body.reason).trim() : "",
      before: Object.fromEntries(changed.map((k) => [k, before[k]])),
      after: Object.fromEntries(changed.map((k) => [k, customer[k]])),
    });
  }
  if (openingChange) {
    await logChange(req, {
      area: "customer",
      action: "edit",
      summary: `Old balance of ${customer.name} corrected: ${rs(openingChange.prev)} → ${rs(openingChange.next)} (khata ${rs(openingChange.balanceBefore)} → ${rs(openingChange.balanceAfter)})`,
      reason: openingChange.reason,
      before: { openingBalance: openingChange.prev, balance: openingChange.balanceBefore },
      after: { openingBalance: openingChange.next, balance: openingChange.balanceAfter },
    });
  }
  res.json(customer);
});

// Admin only: remove a customer added by mistake (e.g. a duplicate). Only allowed while
// they have no bills, payments or returns, so no record ever loses its customer.
export const deleteCustomer = asyncHandler(async (req, res) => {
  const reason = requireReason(req.body?.reason);
  const customer = await Customer.findById(req.params.id);
  if (!customer) return res.status(404).json({ message: "Customer not found" });
  const [bills, payments, returns] = await Promise.all([
    Sale.countDocuments({ customer: customer._id }),
    Payment.countDocuments({ customer: customer._id }),
    Wapsi.countDocuments({ customer: customer._id }),
  ]);
  if (bills || payments || returns) {
    const what = [bills && `${bills} bill(s)`, payments && `${payments} payment(s)`, returns && `${returns} return(s)`]
      .filter(Boolean)
      .join(", ");
    return res.status(400).json({ message: `${customer.name} has ${what}, so the khata can't be deleted.` });
  }
  await customer.deleteOne();
  await logChange(req, {
    area: "customer",
    action: "delete",
    summary: `Customer ${customer.name} deleted${customer.openingBalance > 0 ? ` (had old balance ${rs(customer.openingBalance)})` : ""}`,
    reason,
    before: customer.toObject(),
  });
  res.json({ message: "Customer deleted" });
});
