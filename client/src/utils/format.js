export const formatMoney = (value) => {
  const n = Number(value || 0);
  return `Rs ${n.toLocaleString("en-PK", { maximumFractionDigits: 0 })}`;
};

export const formatGrams = (grams) => {
  const g = Number(grams || 0);
  const kg = g / 1000;
  // Always show in KG. Trim to at most 3 decimal places, dropping trailing zeros,
  // so 5000g -> "5 KG", 22345g -> "22.345 KG", 555g -> "0.555 KG".
  const trimmed = parseFloat(kg.toFixed(3));
  return `${trimmed} KG`;
};

export const formatDate = (d) =>
  new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

export const formatDateTime = (d) =>
  new Date(d).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export const gramsPresets = [100, 200, 250, 500, 750, 1000, 2000, 5000];

// Pakistani/Urdu-style short numbering: Hazar (thousand), Lakh (100,000), Crore (10,000,000)
export const formatMoneyUrdu = (value) => {
  const n = Math.abs(Number(value || 0));
  const sign = Number(value || 0) < 0 ? "-" : "";
  if (n >= 1e7) return `${sign}${(n / 1e7).toFixed(2)} Crore`;
  if (n >= 1e5) return `${sign}${(n / 1e5).toFixed(2)} Lakh`;
  if (n >= 1e3) return `${sign}${(n / 1e3).toFixed(1)} Hazar`;
  return `${sign}${n.toLocaleString("en-PK")}`;
};

export const formatMoneyFull = (value) => `${formatMoney(value)} (${formatMoneyUrdu(value)})`;

// Whose account an online payment landed in, plus the bank, e.g. "Asim Account (UBL)",
// so it's clear which of the several bank accounts received the money.
export const accountLabel = (account) => {
  const owner =
    account?.ownerType === "asim"
      ? "Asim Account"
      : account?.ownerType === "salesman"
        ? "Salesman Account"
        : "Online Transfer";
  const bank = (account?.bankName || "").trim();
  return bank && bank.toLowerCase() !== owner.toLowerCase() ? `${owner} (${bank})` : owner;
};

// A sale can be paid as: Cash, Credit (Khata), or Cash-but-received-online into
// either the Salesman's or one of Asim's accounts. This gives one consistent
// label + badge class for all four, wherever a payment method needs to be shown.
export const paymentLabel = (sale) => {
  if (sale.paymentType === "credit") return "Credit";
  if (sale.paymentMethod === "online") return accountLabel(sale.account);
  return "Cash";
};

export const paymentBadgeClass = (sale) => {
  if (sale.paymentType === "credit") return "badge-credit";
  if (sale.paymentMethod === "online") return "badge-account";
  return "badge-cash";
};

// Turns a "YYYY-MM" month-picker value into the first/last calendar day of that month.
export const monthBounds = (monthStr) => {
  if (!monthStr) return { from: "", to: "" };
  const [year, month] = monthStr.split("-").map(Number);
  const from = `${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
};
