import ChangeLog from "../models/ChangeLog.js";

// Records a correction. The change itself has already been saved by the caller, so a
// failure here is logged to the console instead of failing the user's request.
export const logChange = async (req, { area, action, summary, reason = "", before, after }) => {
  try {
    await ChangeLog.create({ area, action, summary, reason, before, after, createdBy: req.user?._id });
  } catch (err) {
    console.error("Could not write change log:", err.message);
  }
};

// "12.5 KG" style text for khula amounts stored in grams.
export const kgText = (grams) => `${parseFloat((Number(grams || 0) / 1000).toFixed(3))} KG`;

// Small amounts read better in grams: "300 g", but "1.25 KG" from 1 KG up.
export const shortText = (grams) => (Math.abs(grams) < 1000 ? `${Math.round(Math.abs(grams))} g` : kgText(Math.abs(grams)));

// "Rs 12,500" style text for money.
export const rs = (amount) => `Rs ${Number(amount || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;

// Same wording the app uses for accounts, e.g. "Asim Account (UBL)".
export const accountText = (account) => {
  if (!account) return "";
  const owner = account.ownerType === "asim" ? "Asim Account" : account.ownerType === "salesman" ? "Salesman Account" : "Online Transfer";
  const bank = (account.bankName || "").trim();
  return bank && bank.toLowerCase() !== owner.toLowerCase() ? `${owner} (${bank})` : owner;
};

// A reason is required for every correction.
export const requireReason = (reason) => {
  if (!reason || !String(reason).trim()) {
    throw Object.assign(new Error("Please write a reason for this change"), { statusCode: 400 });
  }
  return String(reason).trim();
};
