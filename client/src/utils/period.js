import { inputDate } from "./format.js";

export const periodPresets = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "year", label: "This year" },
  { key: "custom", label: "Custom" },
];

// "2026-10-01" -> "1 Oct 2026"
const niceDate = (value) => {
  const [y, m, d] = String(value).split("-").map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

// For the middle of a sentence: "No sales today", "Total received this month".
export const periodPhrase = (period) => {
  if (period.key === "custom") {
    if (period.from && period.to) return `from ${niceDate(period.from)} to ${niceDate(period.to)}`;
    if (period.from) return `since ${niceDate(period.from)}`;
    if (period.to) return `up to ${niceDate(period.to)}`;
    return "so far";
  }
  return (periodPresets.find((p) => p.key === period.key)?.label || "").toLowerCase();
};

// Query string for the reports: today/yesterday are worked out by the server (Pakistan time),
// the others become a from/to date range.
export const periodQuery = (period) => {
  const params = new URLSearchParams();
  const now = new Date();
  if (period.key === "today" || period.key === "yesterday") {
    params.set("quick", period.key);
  } else if (period.key === "week") {
    const start = new Date(now);
    start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); // Monday
    params.set("from", inputDate(start));
    params.set("to", inputDate(now));
  } else if (period.key === "month") {
    params.set("from", inputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
    params.set("to", inputDate(now));
  } else if (period.key === "year") {
    params.set("from", inputDate(new Date(now.getFullYear(), 0, 1)));
    params.set("to", inputDate(now));
  } else {
    if (period.from) params.set("from", period.from);
    if (period.to) params.set("to", period.to);
  }
  return params.toString();
};
