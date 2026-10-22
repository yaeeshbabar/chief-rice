import { kgText } from "./changeLog.js";

// The things in a return. Older returns had one item stored on the record itself.
export const wapsiItems = (w) => {
  if (w.items && w.items.length) return w.items;
  if (!w.itemType) return [];
  return [
    {
      itemType: w.itemType,
      riceType: w.riceType,
      riceTypeName: w.riceTypeName,
      boriSize: w.boriSize,
      quantityGrams: w.quantityGrams,
      quantityBori: w.quantityBori,
      khulaBatch: w.khulaBatch,
    },
  ];
};

// Cash that left the counter. Older returns that cut a khata (through a linked credit bill) saved
// the same amount as "cash returned" too, but no cash left the counter for them.
export const wapsiCashOut = (w) =>
  w.refundTo ? w.cashReturned || 0 : Math.max(0, (w.cashReturned || 0) - (w.balanceAdjustment || 0));

// Money given back to the customer, in cash or off their khata.
export const wapsiRefund = (w) => (w.refundTo ? w.amount || 0 : w.cashReturned || 0);

export const wapsiItemText = (i) =>
  i.itemType === "bori" ? `${i.quantityBori} × ${i.boriSize}KG ${i.riceTypeName}` : `${kgText(i.quantityGrams)} ${i.riceTypeName}`;
