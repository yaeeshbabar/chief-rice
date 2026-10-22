import { createPortal } from "react-dom";
import { formatMoney, formatGrams, formatDateTime, paymentLabel, billAdjustment } from "../utils/format.js";

// 80mm thermal paper receipt (about 72mm printable). Rendered in a portal on <body>, hidden on
// screen, and only shown when printing with data-print="thermal". Customer-facing only:
// no cost, profit or commission is ever printed here.
const Dash = () => <div className="tr-dash" />;
const Row = ({ left, right, bold }) => (
  <div className={`tr-row ${bold ? "tr-bold" : ""}`}>
    <span>{left}</span>
    <span>{right}</span>
  </div>
);

const ThermalReceipt = ({ sale, asimAccounts = [] }) => {
  if (!sale) return null;
  const isCredit = sale.paymentType === "credit";

  return createPortal(
    <div className="thermal-receipt">
      <div className="tr-center tr-title">CHIEF RICE TRADERS</div>
      <div className="tr-center">Asim Siddique</div>
      <div className="tr-center">Rice Wholesale &amp; Retail</div>
      <Dash />
      <Row left="Invoice #" right={sale.invoiceNumber} bold />
      <Row left="Bill # (today)" right={sale.dailyBillNumber} />
      <Row left="Date" right={formatDateTime(sale.createdAt)} />
      <Row left="Served by" right={sale.createdBy?.name || ""} />
      <div className="tr-block">
        <span className="tr-bold">Customer: </span>
        {sale.customer ? sale.customer.name : "Walk-in"}
        {sale.customer?.shopName ? ` (${sale.customer.shopName})` : ""}
        {sale.customer?.phone ? ` ${sale.customer.phone}` : ""}
      </div>
      <Dash />
      {sale.items.map((item, idx) => (
        <div key={idx} className="tr-item">
          <div className="tr-bold">
            {item.riceTypeName || item.riceType?.name} <span className="tr-normal">({item.itemType === "khula" ? "Khula" : `${item.boriSize}KG Bori`})</span>
          </div>
          <div className="tr-row">
            <span>
              {item.itemType === "khula" ? formatGrams(item.quantityGrams) : `${item.quantityBori} bori`} x {formatMoney(item.pricePerUnit)}
              {item.itemType === "khula" ? "/KG" : ""}
            </span>
            <span>{formatMoney(item.total)}</span>
          </div>
        </div>
      ))}
      <Dash />
      {billAdjustment(sale) !== 0 && (
        <>
          <Row left="Bill" right={formatMoney(sale.subtotal)} />
          <Row
            left={billAdjustment(sale) < 0 ? "Discount" : "Extra"}
            right={`${billAdjustment(sale) < 0 ? "- " : "+ "}${formatMoney(Math.abs(billAdjustment(sale)))}`}
          />
        </>
      )}
      <div className="tr-row tr-total">
        <span>{billAdjustment(sale) !== 0 ? "PAID" : "TOTAL"}</span>
        <span>{formatMoney(sale.total)}</span>
      </div>
      <Row left="Payment" right={paymentLabel(sale)} />
      {isCredit && sale.customer && <Row left="Total khata due" right={formatMoney(sale.customer.balance)} bold />}
      {isCredit && asimAccounts.length > 0 && (
        <>
          <Dash />
          <div className="tr-center tr-bold">Pay online to:</div>
          {asimAccounts.map((a) => (
            <div key={a._id} className="tr-acc">
              <div className="tr-bold">
                {a.bankName} — {a.accountTitle}
              </div>
              <div>A/C {a.accountNumber}</div>
              {a.iban && <div>{a.iban}</div>}
            </div>
          ))}
        </>
      )}
      <Dash />
      <div className="tr-center">Thank you for your business</div>
      <div className="tr-center tr-small">Please keep this receipt</div>
    </div>,
    document.body
  );
};

export default ThermalReceipt;
