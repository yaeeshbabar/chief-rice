import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { connectDB } from "../config/db.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import RiceType from "../models/RiceType.js";
import Stock from "../models/Stock.js";
import ExpenseOption from "../models/ExpenseOption.js";
import BankAccount from "../models/BankAccount.js";

const run = async () => {
  await connectDB();

  // Passwords come from server/.env so they are never stored in the code on GitHub.
  const needPassword = (name) => {
    const value = process.env[name];
    if (!value) throw new Error(`Add ${name}=... to server/.env, then run the seed again.`);
    return value;
  };

  const admin = await User.findOne({ username: "asim" });
  if (!admin) {
    await User.create({ username: "asim", password: needPassword("SEED_ADMIN_PASSWORD"), name: "Asim Siddique", role: "admin" });
    console.log("Created admin user: asim");
  } else {
    console.log("Admin user already exists");
  }

  const salesman = await User.findOne({ username: "salesman" });
  if (!salesman) {
    await User.create({ username: "salesman", password: needPassword("SEED_SALESMAN_PASSWORD"), name: "Salesman", role: "salesman" });
    console.log("Created salesman user: salesman");
  } else {
    console.log("Salesman user already exists");
  }

  const defaultTypes = ["Sela", "Tota", "Basmati", "Banaspati"];
  for (const name of defaultTypes) {
    let type = await RiceType.findOne({ name });
    if (!type) {
      type = await RiceType.create({ name });
      await Stock.create({ riceType: type._id, boriSize: 25, quantity: 0 });
      await Stock.create({ riceType: type._id, boriSize: 50, quantity: 0 });
      console.log(`Created rice type: ${name}`);
    }
  }

  const defaultRentTypes = ["Store Rent", "House Rent", "House 2 Rent"];
  for (const name of defaultRentTypes) {
    const exists = await ExpenseOption.findOne({ type: "rentType", name });
    if (!exists) await ExpenseOption.create({ type: "rentType", name });
  }

  // Asim's real bank accounts live in seed-accounts.json, which stays on your computer
  // (it's in .gitignore). See seed-accounts.example.json for the format.
  const accountsFile = new URL("./seed-accounts.json", import.meta.url);
  const asimAccounts = existsSync(accountsFile) ? JSON.parse(readFileSync(accountsFile, "utf8")) : [];
  if (!asimAccounts.length) console.log("No seed-accounts.json found - add bank accounts from Settings instead.");
  for (const acc of asimAccounts) {
    const exists = await BankAccount.findOne({ accountNumber: acc.accountNumber });
    if (!exists) {
      await BankAccount.create({ ownerType: "asim", ownerName: "Asim Siddique", ...acc });
      console.log(`Added Asim bank account: ${acc.bankName}`);
    }
  }

  // A single default salesman account, shown simply as "Salesman Account" (no bank details needed
  // since there's only ever one) wherever an online payment destination is picked.
  const salesmanAccountExists = await BankAccount.findOne({ ownerType: "salesman" });
  if (!salesmanAccountExists) {
    await BankAccount.create({
      ownerType: "salesman",
      ownerName: "Salesman Account",
      bankName: "Salesman Account",
      accountTitle: "Salesman Account",
      accountNumber: "salesman-account",
    });
    console.log("Added default Salesman Account");
  }

  console.log("Seed complete.");
  await mongoose.connection.close();
  process.exit(0);
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
