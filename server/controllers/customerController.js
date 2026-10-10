import Customer from "../models/Customer.js";
import Sale from "../models/Sale.js";
import { asyncHandler } from "../middleware/errorHandler.js";

export const listCustomers = asyncHandler(async (req, res) => {
  const { search } = req.query;
  const filter = {};
  if (search) {
    filter.$or = [
      { name: new RegExp(search, "i") },
      { shopName: new RegExp(search, "i") },
      { phone: new RegExp(search, "i") },
    ];
  }
  const customers = await Customer.find(filter).sort({ name: 1 });
  res.json(customers);
});

export const createCustomer = asyncHandler(async (req, res) => {
  const { name, shopName, phone, address } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ message: "Customer name is required" });
  const customer = await Customer.create({
    name: name.trim(),
    shopName: shopName || "",
    phone: phone || "",
    address: address || "",
    createdBy: req.user._id,
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
  if (name) customer.name = name.trim();
  if (shopName !== undefined) customer.shopName = shopName;
  if (phone !== undefined) customer.phone = phone;
  if (address !== undefined) customer.address = address;
  await customer.save();
  res.json(customer);
});
