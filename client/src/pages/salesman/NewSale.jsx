import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck, Eye, EyeOff, Plus, X } from "lucide-react";
import api from "../../api/axios.js";
import Loader from "../../components/Loader.jsx";
import CustomerPicker from "../../components/CustomerPicker.jsx";
import AccountSelect from "../../components/AccountSelect.jsx";
import { formatMoney, formatGrams, gramsPresets } from "../../utils/format.js";
import { useBilling } from "../../context/BillingContext.jsx";
import { RiceBin } from "../../components/KhulaContainers.jsx";

const NewSale = () => {
  const navigate = useNavigate();
  const { bills, activeBill, updateActiveBill, addBill, switchBill, closeBill, resetActiveBill } = useBilling();
  const [loading, setLoading] = useState(true);
  const [riceTypes, setRiceTypes] = useState([]);
  const [khulaPools, setKhulaPools] = useState([]);
  const [stock, setStock] = useState([]);
  const [agents, setAgents] = useState([]);
  const [tab, setTab] = useState("khula");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState(null);
  const [showCost, setShowCost] = useState(false);

  // khula form
  const [khulaRiceType, setKhulaRiceType] = useState("");
  const [khulaGrams, setKhulaGrams] = useState("");
  const [khulaPrice, setKhulaPrice] = useState("");

  // bori form
  const [boriRiceType, setBoriRiceType] = useState("");
  const [boriSize, setBoriSize] = useState(25);
  const [boriQty, setBoriQty] = useState("");
  const [boriPrice, setBoriPrice] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get("/rice-types"),
      api.get("/khula/summary"),
      api.get("/stock"),
      api.get("/commission-agents"),
    ])
      .then(([rt, kb, st, ca]) => {
        setRiceTypes(rt.data);
        setKhulaPools(kb.data);
        setStock(st.data);
        setAgents(ca.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Khula is sold by rice type: all open bori, loose rice and returns of a type count together.
  const poolFor = (riceTypeId) => khulaPools.find((p) => p.riceType?._id === riceTypeId);
  const selectedPool = poolFor(khulaRiceType);

  const stockForBoriType = useMemo(() => stock.filter((s) => s.riceType?._id === boriRiceType), [stock, boriRiceType]);
  const selectedStock = stockForBoriType.find((s) => s.boriSize === Number(boriSize));

  // Items already sitting in ANY open draft bill (this one or another tab) haven't been
  // submitted to the server yet, so the server's remainingGrams/quantity numbers don't
  // reflect them. Subtract those out here so the on-screen "remaining" always matches
  // what's actually still free to add, not what the last server fetch said.
  const reservedGramsForType = (riceTypeId) =>
    bills.reduce(
      (sum, bill) =>
        sum +
        bill.cart
          .filter((i) => i.itemType === "khula" && i.riceTypeId === riceTypeId)
          .reduce((s, i) => s + i.quantityGrams, 0),
      0
    );
  const khulaLeftFor = (riceTypeId) => (poolFor(riceTypeId)?.remainingGrams || 0) - reservedGramsForType(riceTypeId);
  const reservedBoriFor = (riceTypeId, size) =>
    bills.reduce(
      (sum, bill) =>
        sum +
        bill.cart
          .filter((i) => i.itemType === "bori" && i.riceTypeId === riceTypeId && i.boriSize === Number(size))
          .reduce((s, i) => s + i.quantityBori, 0),
      0
    );

  const effectiveRemainingGrams = khulaRiceType ? khulaLeftFor(khulaRiceType) : 0;
  const effectiveAvailableBori = selectedStock ? selectedStock.quantity - reservedBoriFor(boriRiceType, boriSize) : 0;


  if (!activeBill) return <Loader />;
  const cart = activeBill.cart;
  const activeBillNumber = bills.findIndex((b) => b.id === activeBill.id) + 1;

  const addKhulaToCart = () => {
    setError("");
    if (!khulaRiceType || !khulaGrams || !khulaPrice) {
      setError("Fill rice type, quantity and price");
      return;
    }
    if (Number(khulaGrams) <= 0) {
      setError("Enter how many grams");
      return;
    }
    if (Number(khulaGrams) > effectiveRemainingGrams) {
      setError(`Only ${formatGrams(Math.max(0, effectiveRemainingGrams))} of this rice is left in khula`);
      return;
    }
    const riceType = riceTypes.find((r) => r._id === khulaRiceType);
    const total = (Number(khulaGrams) / 1000) * Number(khulaPrice);
    updateActiveBill((b) => ({
      cart: [
        ...b.cart,
        {
          itemType: "khula",
          riceTypeId: khulaRiceType,
          riceTypeName: riceType.name,
          quantityGrams: Number(khulaGrams),
          pricePerUnit: Number(khulaPrice),
          total,
        },
      ],
    }));
    setKhulaGrams("");
    setKhulaPrice("");
  };

  const addBoriToCart = () => {
    setError("");
    if (!boriRiceType || !boriQty || !boriPrice) {
      setError("Fill rice type, quantity and price");
      return;
    }
    if (!selectedStock || Number(boriQty) > effectiveAvailableBori) {
      setError(`Only ${effectiveAvailableBori} bori available in this size`);
      return;
    }
    const riceType = riceTypes.find((r) => r._id === boriRiceType);
    const total = Number(boriQty) * Number(boriPrice);
    updateActiveBill((b) => ({
      cart: [
        ...b.cart,
        {
          itemType: "bori",
          riceTypeId: boriRiceType,
          riceTypeName: riceType.name,
          boriSize: Number(boriSize),
          quantityBori: Number(boriQty),
          pricePerUnit: Number(boriPrice),
          total,
        },
      ],
    }));
    setBoriQty("");
    setBoriPrice("");
  };

  const removeFromCart = (idx) => updateActiveBill((b) => ({ cart: b.cart.filter((_, i) => i !== idx) }));

  const subtotal = cart.reduce((sum, i) => sum + i.total, 0);
  const total = subtotal; // Ride is never charged to the customer - it's a separate store expense below.

  const submitSale = async () => {
    setError("");
    if (!cart.length) {
      setError("Add at least one item to the bill");
      return;
    }
    if (activeBill.paymentType === "credit" && !activeBill.selectedCustomerId && !(activeBill.addingNewCustomer && activeBill.newCustomer.name)) {
      setError("Select a credit customer or add a new one");
      return;
    }
    if (activeBill.paymentType === "cash" && activeBill.paymentMethod === "online" && !activeBill.accountId) {
      setError("Select which account the payment was received into");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        items: cart.map((i) => ({
          itemType: i.itemType,
          riceTypeId: i.riceTypeId,
          boriSize: i.itemType === "bori" ? i.boriSize : undefined,
          quantityGrams: i.quantityGrams,
          quantityBori: i.quantityBori,
          pricePerUnit: i.pricePerUnit,
        })),
        paymentType: activeBill.paymentType,
        rideCost: Number(activeBill.rideCost || 0),
        commissionAgentId: activeBill.commissionAgentId || undefined,
      };
      if (activeBill.paymentType === "credit") {
        if (activeBill.addingNewCustomer) payload.newCustomer = activeBill.newCustomer;
        else payload.customerId = activeBill.selectedCustomerId;
      } else {
        payload.paymentMethod = activeBill.paymentMethod || "cash";
        if (payload.paymentMethod === "online") payload.accountId = activeBill.accountId;
      }
      const { data } = await api.post("/sales", payload);
      setSuccessInvoice(data);
      resetActiveBill();
      load();
    } catch (err) {
      setError(err?.response?.data?.message || "Could not create the invoice");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <h2 className="page-title">New sale</h2>

      {/* Multi-bill tab bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {bills.map((b, idx) => (
          <button
            key={b.id}
            onClick={() => switchBill(b.id)}
            className={`shrink-0 flex items-center gap-2 pl-3.5 pr-2.5 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              b.id === activeBill.id
                ? "bg-[var(--accent-tint)] text-[var(--ink)] border-[var(--accent)]"
                : "bg-[var(--surface)] text-[var(--ink-muted)] border-[var(--line)] hover:border-[var(--line-strong)]"
            }`}
          >
            Bill {idx + 1}
            {b.cart.length > 0 && (
              <span
                className={`text-[0.7rem] font-semibold rounded-full min-w-[1.25rem] px-1.5 ${
                  b.id === activeBill.id ? "bg-[var(--accent)] text-white" : "bg-[var(--bg-subtle)]"
                }`}
              >
                {b.cart.length}
              </span>
            )}
            {bills.length > 1 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  closeBill(b.id);
                }}
                className="grid place-items-center rounded p-0.5 text-[var(--ink-faint)] hover:text-[var(--ink)]"
                aria-label={`Close bill ${idx + 1}`}
              >
                <X size={14} />
              </span>
            )}
          </button>
        ))}
        <button
          onClick={addBill}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--line-strong)] px-3 py-1.5 text-sm text-[var(--ink-muted)] hover:text-[var(--ink)] hover:border-[var(--ink-faint)]"
          title="Start a new bill (e.g. for a waiting customer)"
        >
          <Plus size={15} />
          New bill
        </button>
      </div>

      {loading ? (
        <Loader label="Loading stock..." />
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="grid grid-cols-2 gap-2 flex-1 min-w-[260px]">
                {[
                  { key: "khula", label: "Khula (loose)", img: "/assets/khula.png" },
                  { key: "bori", label: "Bori (bags)", img: "/assets/bori.png" },
                ].map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={`flex items-center gap-3 rounded-xl border p-2 pr-3 text-left text-sm font-medium transition-colors ${
                      tab === t.key
                        ? "border-[var(--accent)] bg-[var(--accent-tint)] text-[var(--ink)]"
                        : "border-[var(--line)] bg-[var(--surface)] text-[var(--ink-muted)] hover:border-[var(--line-strong)]"
                    }`}
                  >
                    <img src={t.img} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowCost((s) => !s)}
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink)]"
                title="Toggle purchase cost visibility"
              >
                {showCost ? <EyeOff size={16} /> : <Eye size={16} />}
                {showCost ? "Hide cost" : "Show cost"}
              </button>
            </div>

            {tab === "khula" ? (
              <div className="grain-card p-4 flex flex-col gap-3">
                <h3 className="section-title">Sell khula (loose rice)</h3>
                <div>
                  <label className="field-label">Rice type</label>
                  <select className="field-input" value={khulaRiceType} onChange={(e) => setKhulaRiceType(e.target.value)}>
                    <option value="">Select rice type</option>
                    {riceTypes.map((rt) => {
                      const left = khulaLeftFor(rt._id);
                      return (
                        <option key={rt._id} value={rt._id}>
                          {rt.name} {poolFor(rt._id) ? `· ${formatGrams(Math.max(0, left))} in khula` : "· no khula"}
                        </option>
                      );
                    })}
                  </select>
                </div>
                {khulaRiceType &&
                  (selectedPool ? (
                    <div className="flex items-center gap-3 rounded-lg bg-[var(--bg-subtle)] px-3 py-2.5">
                      <div className="w-8 shrink-0">
                        <RiceBin
                          small
                          percent={selectedPool.capacityGrams > 0 ? (Math.max(0, effectiveRemainingGrams) / selectedPool.capacityGrams) * 100 : 0}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          In khula right now:{" "}
                          <span className={effectiveRemainingGrams > 0 ? "text-[var(--pos-ink)]" : "text-[var(--neg-ink)]"}>
                            {formatGrams(Math.max(0, effectiveRemainingGrams))}
                          </span>
                        </p>
                        <p className="text-xs text-[var(--ink-muted)]">
                          {selectedPool.batches.length > 1
                            ? `${selectedPool.batches.length} lots added together, oldest is sold first`
                            : "1 lot"}
                          {reservedGramsForType(khulaRiceType) > 0 && ` · ${formatGrams(reservedGramsForType(khulaRiceType))} already on open bills`}
                        </p>
                        {showCost && (
                          <p className="text-xs font-semibold text-[var(--accent-ink)] mt-0.5">
                            Purchase cost: about {formatMoney(selectedPool.avgCostPerKg)} / KG
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--neg-ink)] bg-[var(--neg-tint)] rounded-lg px-3 py-2">
                      No khula of this rice type. Open a bori to khula from the Khula page; this bill stays open.
                    </p>
                  ))}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Quantity (grams)</label>
                    <input type="number" min="1" className="field-input mb-2" value={khulaGrams} onChange={(e) => setKhulaGrams(e.target.value)} placeholder="e.g. 500" />
                    <div className="flex flex-wrap gap-1.5">
                      {gramsPresets.map((g) => (
                        <button
                          type="button"
                          key={g}
                          onClick={() => setKhulaGrams(String(g))}
                          className="text-xs font-medium px-2 py-1 rounded-md border border-[var(--line)] bg-[var(--surface)] hover:bg-[var(--bg-subtle)]"
                        >
                          {formatGrams(g)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="field-label">Price per KG (Rs)</label>
                    <input type="number" min="0" className="field-input" value={khulaPrice} onChange={(e) => setKhulaPrice(e.target.value)} />
                  </div>
                </div>
                <button className="btn-primary self-start" onClick={addKhulaToCart}>
                  <Plus size={16} />
                  Add to bill
                </button>
              </div>
            ) : (
              <div className="grain-card p-4 flex flex-col gap-3">
                <h3 className="section-title">Sell bori (full bags)</h3>
                <div>
                  <label className="field-label">Rice type</label>
                  <select className="field-input" value={boriRiceType} onChange={(e) => setBoriRiceType(e.target.value)}>
                    <option value="">Select rice type</option>
                    {riceTypes.map((rt) => (
                      <option key={rt._id} value={rt._id}>
                        {rt.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="field-label">Bori size</label>
                  <div className="flex gap-2">
                    {[25, 50].map((sz) => (
                      <button
                        type="button"
                        key={sz}
                        onClick={() => setBoriSize(sz)}
                        className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                          Number(boriSize) === sz ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]" : "border-[var(--color-husk)]"
                        }`}
                      >
                        {sz} KG
                      </button>
                    ))}
                  </div>
                  {boriRiceType && (
                    <p className="text-sm font-medium mt-2">
                      Available:{" "}
                      <span
                        className={`px-2 py-0.5 rounded-md ${
                          effectiveAvailableBori > 0
                            ? "bg-[var(--surface-soft)] text-[var(--color-sage-deep)]"
                            : "bg-[var(--surface-soft-danger)] text-[var(--color-terracotta-deep)]"
                        }`}
                      >
                        {effectiveAvailableBori} bori
                      </span>
                    </p>
                  )}
                  {showCost && selectedStock && (
                    <p className="text-xs font-bold text-[var(--color-wheat-dark)] mt-1">
                      Purchase cost: {formatMoney(selectedStock.lastPricePerBori)} / bori
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="field-label">Number of bori</label>
                    <input type="number" min="1" className="field-input" value={boriQty} onChange={(e) => setBoriQty(e.target.value)} placeholder="e.g. 1, 3, 10" />
                  </div>
                  <div>
                    <label className="field-label">Price per bori (Rs)</label>
                    <input type="number" min="0" className="field-input" value={boriPrice} onChange={(e) => setBoriPrice(e.target.value)} />
                  </div>
                </div>
                <button className="btn-primary self-start" onClick={addBoriToCart}>
                  <Plus size={16} />
                  Add to bill
                </button>
              </div>
            )}

            <div className="grain-card p-4 flex flex-col gap-3">
              <h3 className="section-title">Delivery &amp; commission (optional)</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="field-label">Delivery cost (Rs), not on the bill</label>
                  <input
                    type="number"
                    min="0"
                    className="field-input"
                    value={activeBill.rideCost || ""}
                    onChange={(e) => updateActiveBill({ rideCost: e.target.value })}
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="field-label">Commission salesman (if it is their sale)</label>
                  <select
                    className="field-input"
                    value={activeBill.commissionAgentId || ""}
                    onChange={(e) => updateActiveBill({ commissionAgentId: e.target.value })}
                  >
                    <option value="">None</option>
                    {agents.map((a) => (
                      <option key={a._id} value={a._id}>
                        {a.name} — {a.percentage}% of profit
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grain-card p-4 flex flex-col gap-3">
              <h3 className="section-title">Bill {activeBillNumber}</h3>
              {cart.length ? (
                <div className="flex flex-col gap-2">
                  {cart.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-[var(--color-cream-deep)] rounded-lg px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium">{item.riceTypeName}</p>
                        <p className="text-xs text-[var(--color-coffee-soft)]">
                          {item.itemType === "khula" ? formatGrams(item.quantityGrams) : `${item.quantityBori} × ${item.boriSize}KG bori`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{formatMoney(item.total)}</span>
                        <button
                          onClick={() => removeFromCart(idx)}
                          className="grid place-items-center rounded p-1 text-[var(--ink-faint)] hover:text-[var(--neg-ink)] hover:bg-[var(--neg-tint)]"
                          aria-label="Remove item"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[var(--color-coffee-soft)] text-center py-6">No items added yet</p>
              )}

              <div>
                <label className="field-label">Payment type</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => updateActiveBill({ paymentType: "cash" })}
                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${activeBill.paymentType === "cash" ? "border-[var(--color-sage-deep)] bg-[var(--surface-soft)]" : "border-[var(--color-husk)]"}`}
                  >
                    Cash
                  </button>
                  <button
                    onClick={() => updateActiveBill({ paymentType: "credit" })}
                    className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${activeBill.paymentType === "credit" ? "border-[var(--color-terracotta-deep)] bg-[var(--surface-soft-danger)]" : "border-[var(--color-husk)]"}`}
                  >
                    Credit (Khata)
                  </button>
                </div>
              </div>

              {activeBill.paymentType === "cash" && (
                <div className="flex flex-col gap-2">
                  <label className="field-label">Received as</label>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateActiveBill({ paymentMethod: "cash" })}
                      className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${(activeBill.paymentMethod || "cash") === "cash" ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]" : "border-[var(--color-husk)]"}`}
                    >
                      Cash
                    </button>
                    <button
                      onClick={() => updateActiveBill({ paymentMethod: "online" })}
                      className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${activeBill.paymentMethod === "online" ? "border-[var(--color-wheat)] bg-[var(--color-cream-deep)]" : "border-[var(--color-husk)]"}`}
                    >
                      Online transfer
                    </button>
                  </div>
                  {activeBill.paymentMethod === "online" && (
                    <AccountSelect value={activeBill.accountId || ""} onChange={(accountId) => updateActiveBill({ accountId })} />
                  )}
                </div>
              )}

              {activeBill.paymentType === "credit" && (
                <CustomerPicker
                  addingNew={activeBill.addingNewCustomer}
                  onModeChange={(v) => updateActiveBill({ addingNewCustomer: v })}
                  selectedId={activeBill.selectedCustomerId}
                  onSelect={(id) => updateActiveBill({ selectedCustomerId: id })}
                  newCustomer={activeBill.newCustomer}
                  onNewCustomerChange={(newCustomer) => updateActiveBill({ newCustomer })}
                />
              )}

              <div className="border-t border-[var(--color-husk)] pt-3 flex flex-col gap-1">
                <div className="flex justify-between text-sm text-[var(--color-coffee-soft)]">
                  <span>Subtotal</span>
                  <span>{formatMoney(subtotal)}</span>
                </div>
                <div className="flex justify-between font-display text-lg font-semibold">
                  <span>Total (customer pays)</span>
                  <span>{formatMoney(total)}</span>
                </div>
              </div>

              {error && <p className="text-sm text-[var(--color-terracotta-deep)] bg-[var(--surface-soft-danger)] rounded-lg px-3 py-2">{error}</p>}

              <button className="btn-primary" disabled={submitting} onClick={submitSale}>
                {submitting ? "Saving..." : "Complete sale"}
              </button>
            </div>

            {successInvoice && (
              <div className="rounded-xl border border-[var(--pos)] bg-[var(--pos-tint)] p-4">
                <p className="flex items-center gap-2 text-sm font-medium text-[var(--pos-ink)] mb-1.5">
                  <CircleCheck size={16} />
                  Invoice #{successInvoice.invoiceNumber} (Bill #{successInvoice.dailyBillNumber} today) created
                </p>
                <button
                  className="text-sm font-medium text-[var(--accent-ink)] hover:underline"
                  onClick={() => navigate(`/salesman/invoices/${successInvoice._id}`)}
                >
                  View or print invoice
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NewSale;
