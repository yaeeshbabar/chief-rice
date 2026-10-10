// A `to` date like "2026-09-13" parses as midnight UTC, which excludes the
// entire day it names. Every date-range filter in this app must push `to`
// to the end of that calendar day so "today to today" actually includes today.
export const endOfDay = (dateInput) => {
  const d = new Date(dateInput);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const startOfDay = (dateInput) => {
  const d = new Date(dateInput);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Builds a Mongo range filter object from optional `from`/`to` query strings.
export const buildDateRangeFilter = (from, to) => {
  if (!from && !to) return null;
  const range = {};
  if (from) range.$gte = startOfDay(from);
  if (to) range.$lte = endOfDay(to);
  return range;
};

// Same {$gte, $lte} shape as buildDateRangeFilter, so both are interchangeable
// wherever they're assigned straight onto a Mongo filter (e.g. filter.createdAt = ...).
export const todayRange = () => ({ $gte: startOfDay(new Date()), $lte: endOfDay(new Date()) });

export const yesterdayRange = () => {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return { $gte: startOfDay(y), $lte: endOfDay(y) };
};

// YYYY-MM-DD in server local time - used as the key for the daily bill counter.
export const dateKey = (date = new Date()) => {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};
