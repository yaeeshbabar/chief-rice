import { formatGrams, formatMoney } from "./format.js";

// The things in a return. Older returns had one item stored on the record itself.
export const returnItems = (r) => {
  if (r?.items?.length) return r.items;
  if (!r?.itemType) return [];
  return [
    {
      itemType: r.itemType,
      riceTypeName: r.riceTypeName,
      boriSize: r.boriSize,
      quantityGrams: r.quantityGrams,
      quantityBori: r.quantityBori,
    },
  ];
};

export const returnItemText = (i) =>
  i.itemType === "bori" ? `${i.quantityBori} × ${i.boriSize}KG ${i.riceTypeName}` : `${formatGrams(i.quantityGrams)} ${i.riceTypeName}`;

export const returnItemsText = (r) => returnItems(r).map(returnItemText).join(", ");

// Cash that left the counter (older khata returns also saved the amount as "cash returned").
export const returnCash = (r) =>
  r.refundTo ? r.cashReturned || 0 : Math.max(0, (r.cashReturned || 0) - (r.balanceAdjustment || 0));

// "Rehman Traders' khata", "Imran's khata"
const whose = (name) => (/s$/i.test(name) ? `${name}'` : `${name}'s`);

export const returnMoneyText = (r) =>
  r.refundTo === "khata" || r.balanceAdjustment > 0
    ? `${formatMoney(r.balanceAdjustment || 0)} off ${r.customer?.name ? whose(r.customer.name) : "the"} khata`
    : `${formatMoney(returnCash(r))} cash back`;
