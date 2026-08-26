"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseInvoiceAction } from "@/app/admin/purchasing/actions";
import type { ActionState } from "@/app/admin/actions";
import ActionMessage from "@/components/admin/ActionMessage";
import { useLanguage } from "@/components/LanguageProvider";
import { billTotals, shareBillAcrossLines } from "@/lib/purchase-bill";
import { purchaseLineIssue } from "@/lib/purchase-line-check";
import type { PurchaseKind, SupplierLedger, SupplierPaymentMethod } from "@/lib/purchasing";
import type { RawMaterial } from "@/lib/operations";

type PurchaseInvoiceFormProps = {
  supplierLedgers: SupplierLedger[];
  rawMaterials: RawMaterial[];
  /** Catalog product names. A trading-goods line writes the chosen name into
   *  finished stock, which is what the storefront catalog sync matches
   *  against — so a name typed a second way becomes a second product. */
  productNames: string[];
};

/** One row as the form holds it. Everything is a string because that is what an
 *  input gives back; the numbers are parsed only to show the running total. */
type ItemRow = {
  key: number;
  kind: PurchaseKind;
  materialId: string;
  materialName: string;
  materialUnit: string;
  design: string;
  sizeRun: string;
  quantity: string;
  rate: string;
};

const rawMaterialUnits = ["kg", "meter", "pair", "piece", "liter"];

/** The three boxes Enter walks along, in the order a paper bill is read. */
const WALK = ["item", "quantity", "rate"] as const;
type WalkField = (typeof WALK)[number];

function emptyRow(key: number): ItemRow {
  return {
    key,
    kind: "Raw Material",
    materialId: "",
    materialName: "",
    materialUnit: "piece",
    design: "",
    sizeRun: "Mixed",
    quantity: "",
    rate: "",
  };
}

function rowIsTouched(row: ItemRow) {
  return Boolean(row.materialId || row.materialName || row.design || row.quantity || row.rate);
}

/** What the one item box is showing, whichever kind the line is. */
function itemNameOf(row: ItemRow, rawMaterials: RawMaterial[]) {
  if (row.kind === "Trading Goods") return row.design;
  if (row.materialId) {
    return rawMaterials.find((material) => material.id === row.materialId)?.name ?? "";
  }
  return row.materialName;
}

function sameName(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}

const money = (value: number) =>
  `Rs. ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/**
 * The bill, written the way the paper one is read.
 *
 * It used to be three forms on one screen — the bill here, a new supplier
 * further down the page, and a supplier payment below that. A bill that
 * introduced a new supplier and had money handed over with it meant filling
 * all three, in three places, with three saves; the owner's own account of it
 * was that one of the three got forgotten, and it was usually the payment.
 *
 * So a supplier is named in the bill, and what was paid is part of the bill.
 * The separate payment form still exists, for settling an OLD due, which is a
 * different act on a different day.
 */
export default function PurchaseInvoiceForm({
  supplierLedgers,
  rawMaterials,
  productNames,
}: PurchaseInvoiceFormProps) {
  const { text } = useLanguage();
  // A one-line bill is as common as a twenty-five line one, so the form opens
  // as small as the smallest bill.
  const [rows, setRows] = useState<ItemRow[]>([emptyRow(0)]);
  const [nextKey, setNextKey] = useState(1);
  const [discount, setDiscount] = useState("");
  const [tax, setTax] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<SupplierPaymentMethod>("Cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [state, setState] = useState<ActionState | null>(null);
  const [supplierError, setSupplierError] = useState(false);
  const [isSaving, startSaving] = useTransition();
  const router = useRouter();

  // Enter moves the cursor, which means it has to be able to find the box it is
  // moving to — including one on a row that did not exist a moment ago.
  const boxes = useRef(new Map<string, HTMLInputElement | null>());
  // A ref rather than state: the box to move to is decided in a key handler and
  // acted on after the next render, which is a note-to-self, not something the
  // screen is drawn from. Kept as state it would render twice to move a cursor.
  const pendingFocus = useRef<string | null>(null);

  useEffect(() => {
    const key = pendingFocus.current;
    if (!key) return;
    const box = boxes.current.get(key);
    if (!box) return;
    pendingFocus.current = null;
    box.focus();
    box.select();
  });

  function boxKey(rowKey: number, field: WalkField) {
    return `${rowKey}:${field}`;
  }

  function handleWalk(event: React.KeyboardEvent<HTMLInputElement>, index: number, field: WalkField) {
    if (event.key !== "Enter") return;
    // Enter in a form submits it. Here it means "next box", which is what it
    // means on every bill book this shop has ever used.
    event.preventDefault();

    const at = WALK.indexOf(field);
    if (at < WALK.length - 1) {
      pendingFocus.current = boxKey(rows[index].key, WALK[at + 1]);
      return;
    }

    // End of the row: drop to the next serial number rather than sideways. A
    // row typed into has already grown the bill, so there is usually one there;
    // when Enter is pressed on an untouched last row, grow it here.
    const nextRow = rows[index + 1];
    if (nextRow) {
      pendingFocus.current = boxKey(nextRow.key, "item");
      return;
    }

    const grownKey = nextKey;
    setRows((current) => [...current, emptyRow(grownKey)]);
    setNextKey((value) => value + 1);
    pendingFocus.current = boxKey(grownKey, "item");
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);

    // Catch the everyday gaps here — a supplier, a started line with no product —
    // and point at the exact field, before the bill ever leaves the browser.
    // The server still has the final say on the deeper rules.
    const supplierChosen = Boolean(
      String(formData.get("supplierLedgerId") ?? "").trim() ||
        String(formData.get("supplierName") ?? "").trim(),
    );
    const started = rows.filter(rowIsTouched);
    const firstBadIndex = started.findIndex((row) => purchaseLineIssue(row));

    if (!supplierChosen) {
      setSupplierError(true);
      setState({
        ok: false,
        message: text(
          "Choose a supplier, or type a new supplier name.",
          "साहु छान्नुहोस्, वा नयाँ साहुको नाम लेख्नुहोस्।",
        ),
      });
      return;
    }

    if (started.length === 0) {
      setState({
        ok: false,
        message: text(
          "Add at least one item — a product or material, with quantity and rate.",
          "कम्तीमा एउटा सामान राख्नुहोस् — थान र दरसहित।",
        ),
      });
      return;
    }

    if (firstBadIndex !== -1) {
      const issue = purchaseLineIssue(started[firstBadIndex]);
      setState({
        ok: false,
        message: text(
          `Item ${firstBadIndex + 1}: ${issue?.message ?? "please complete this line."}`,
          `क्र.सं. ${firstBadIndex + 1}: ${issue?.message ?? "यो लाइन पूरा गर्नुहोस्।"}`,
        ),
      });
      return;
    }

    startSaving(async () => {
      const result = await createPurchaseInvoiceAction(state, formData);
      setState(result);

      // A saved bill clears the form for the next one, and pulls the new
      // invoice into the lists on the page. Stay put so the confirmation is
      // read, not missed in a redirect.
      if (result.ok) {
        setRows([emptyRow(nextKey)]);
        setNextKey((value) => value + 1);
        setDiscount("");
        setTax("");
        setPaidAmount("");
        setPaymentMethod("Cash");
        router.refresh();
      }
    });
  }

  function updateRow(key: number, patch: Partial<ItemRow>) {
    setRows((current) => {
      const next = current.map((row) => (row.key === key ? { ...row, ...patch } : row));

      // Typing in the last row grows the bill. Twenty-five items should not
      // mean twenty-five trips to an "Add item" button.
      if (next[next.length - 1].key === key && rowIsTouched(next[next.length - 1])) {
        next.push(emptyRow(nextKey));
        setNextKey((value) => value + 1);
      }

      return next;
    });
  }

  /**
   * One box for the item, whichever kind the line is.
   *
   * It used to be two controls — a dropdown of what exists, and a text box for
   * something new, each ignoring the other. One box with the shop's own names
   * offered under it does the same job: a name that matches something already
   * on the books attaches to it, and one that does not starts a new material or
   * a new design. Which matters more than it sounds: "Doctor Chappal moto"
   * spelled a second way is a second item in the stock ledger.
   */
  function setItemName(row: ItemRow, value: string) {
    if (row.kind === "Trading Goods") {
      const known = productNames.find((name) => sameName(name, value));
      updateRow(row.key, { design: known ?? value });
      return;
    }

    const known = rawMaterials.find((material) => sameName(material.name, value));
    updateRow(row.key, {
      materialId: known?.id ?? "",
      materialName: known ? "" : value,
      materialUnit: known?.unit ?? row.materialUnit,
    });
  }

  function setKind(row: ItemRow, kind: PurchaseKind) {
    // The name carries over — the same word was typed either way, and retyping
    // it because the line changed kind is the sort of thing that makes a form
    // feel like an argument.
    const carried = itemNameOf(row, rawMaterials);
    const next = { ...row, kind, materialId: "", materialName: "", design: "" };
    updateRow(row.key, { ...next });
    setItemName({ ...next }, carried);
  }

  // What the supplier's bill should say. Shown while typing so a wrong rate is
  // caught against the paper bill, not a month later in the ledger.
  const totals = useMemo(() => {
    const lines = rows.filter(rowIsTouched).map((row) => ({
      quantity: Number(row.quantity) || 0,
      rate: Number(row.rate) || 0,
    }));

    return {
      lineCount: lines.length,
      ...billTotals(lines, { discount: Number(discount) || 0, tax: Number(tax) || 0 }),
      shares: shareBillAcrossLines(lines, {
        discount: Number(discount) || 0,
        tax: Number(tax) || 0,
      }),
    };
  }, [rows, discount, tax]);

  const paid = Math.min(Math.max(0, Number(paidAmount) || 0), totals.total);
  const due = Math.max(0, totals.total - paid);
  const touchedRows = rows.filter(rowIsTouched);

  /**
   * The four ways a bill gets paid, as four things to press.
   *
   * They were a dropdown at the foot of the form, beside the tax box, which is
   * where the owner stopped noticing them. QR is new: the shop pays suppliers
   * through eSewa and Khalti already and the only place to record it was
   * "Bank".
   */
  const methods: Array<{
    id: SupplierPaymentMethod;
    ne: string;
    en: string;
    icon: React.ReactNode;
  }> = [
    {
      id: "Cash",
      ne: "नगद",
      en: "Cash",
      icon: (
        <>
          <rect x="2" y="6" width="20" height="12" rx="2" />
          <circle cx="12" cy="12" r="2.5" />
        </>
      ),
    },
    {
      id: "Credit",
      ne: "उधारो",
      en: "Credit",
      icon: (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v4l3 2" />
        </>
      ),
    },
    {
      id: "Cheque",
      ne: "चेक",
      en: "Cheque",
      icon: (
        <>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M7 10h6M7 14h3" />
        </>
      ),
    },
    {
      id: "QR",
      ne: "QR",
      en: "QR",
      icon: (
        <>
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <path d="M14 14h3v3h-3zM20 14v3M17 20h4" />
        </>
      ),
    },
  ];

  function chooseMethod(id: SupplierPaymentMethod) {
    setPaymentMethod(id);
    // Credit means nothing was handed over — the server refuses a credit bill
    // carrying a paid amount, so the form should not let one be typed. Cheque
    // and QR are handed over whole; cash is as often part.
    if (id === "Credit") setPaidAmount("");
    if (id === "Cheque" || id === "QR") setPaidAmount(String(totals.total || ""));
  }

  const referenceLabel =
    paymentMethod === "QR"
      ? text("Which wallet — eSewa, Khalti, Fonepay", "कुन app — eSewa, Khalti, Fonepay")
      : paymentMethod === "Cheque"
        ? text("Cheque number", "चेक नम्बर")
        : text("Cheque / bank / reference no.", "चेक / बैंक / रेफरेन्स नं.");

  const cell =
    "h-11 rounded-md border px-3 text-sm outline-none transition focus:border-brand-green focus:ring-2 focus:ring-brand-green/15";
  const plain = `${cell} border-brand-green-line bg-brand-paper`;
  const wrong = `${cell} border-brand-clay bg-brand-clay-tint/40`;
  const fieldClass = (bad: boolean) => (bad ? wrong : plain);

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-brand-green-line bg-brand-paper p-4 shadow-sm md:p-5"
    >
      {/* The server reads item0..itemN-1, so it has to know how many rows were
          rendered rather than guessing a maximum. */}
      <input type="hidden" name="itemCount" value={rows.length} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />
      <datalist id="purchase-materials">
        {rawMaterials.map((material) => (
          <option key={material.id} value={material.name} />
        ))}
      </datalist>
      <datalist id="purchase-designs">
        {productNames.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>

      <div className="mb-5">
        <h2 className="text-lg font-black text-brand-green-ink">
          {text("Purchase", "किनमेल")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
          {text(
            "One supplier bill, however many items it lists — the supplier, what came in, and what was paid, in one place. Raw material goes to the factory store; ready-made pairs go straight to sellable stock. A bill can carry both.",
            "एउटै साहुको बिल, जति सामान भए पनि — साहु, आएको माल, र तिरेको पैसा, सबै एकै ठाउँ। कच्चा माल कारखानाको भण्डारमा, तयारी जुत्ता सिधै बिक्रीयोग्य स्टकमा। एउटै बिलमा दुवै मिल्छ।",
          )}
        </p>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <div className="grid gap-5">
          {/* ── Who it came from ─────────────────────────────────────── */}
          <section>
            <h3 className="text-sm font-black text-brand-green-ink">
              {text("Who it came from", "कसबाट")}
            </h3>
            <div className="mt-2 grid gap-3 md:grid-cols-3">
              <select
                name="supplierLedgerId"
                className={fieldClass(supplierError)}
                defaultValue=""
                aria-label={text("Supplier", "साहु")}
                onChange={() => setSupplierError(false)}
              >
                <option value="">{text("＋ New supplier (type name)", "＋ नयाँ साहु (नाम लेख्ने)")}</option>
                {supplierLedgers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.supplierName}
                  </option>
                ))}
              </select>
              <input
                name="supplierName"
                className={fieldClass(supplierError)}
                placeholder={text("New supplier name", "नयाँ साहुको नाम")}
                onChange={() => setSupplierError(false)}
              />
              <input
                name="phone"
                className={plain}
                placeholder={text("Supplier phone", "साहुको फोन")}
              />
            </div>
            {supplierError ? (
              <p className="mt-1.5 text-xs font-semibold text-brand-clay">
                {text(
                  "Pick a supplier above, or type a new supplier name.",
                  "माथिबाट साहु छान्नुहोस्, वा नयाँ नाम लेख्नुहोस्।",
                )}
              </p>
            ) : null}
          </section>

          {/* ── What came in ─────────────────────────────────────────── */}
          <section>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-sm font-black text-brand-green-ink">
                {text("What came in", "के किन्यो")}
              </h3>
              <p className="text-xs text-brand-muted">
                {text("Enter moves to the next line", "Enter थिच्दा तलको लाइनमा जान्छ")}
              </p>
            </div>

            <div className="mt-2 hidden gap-2 px-1 text-[10px] font-black uppercase tracking-[0.12em] text-brand-muted-soft md:grid md:grid-cols-[42px_104px_minmax(0,1.5fr)_0.7fr_0.85fr_1fr_40px]">
              <span>{text("S.N.", "क्र.सं.")}</span>
              <span>{text("Kind", "प्रकार")}</span>
              <span>{text("Item", "सामान")}</span>
              <span className="text-right">{text("Qty", "थान")}</span>
              <span className="text-right">{text("Rate", "दर")}</span>
              <span className="text-right">{text("Amount", "रकम")}</span>
              <span />
            </div>

            <div className="mt-2 grid gap-3">
              {rows.map((row, index) => {
                const trading = row.kind === "Trading Goods";
                const issue = purchaseLineIssue(row);
                const touched = rowIsTouched(row);
                const share = touched
                  ? totals.shares[touchedRows.findIndex((item) => item.key === row.key)]
                  : undefined;
                const lineAmount = (Number(row.quantity) || 0) * (Number(row.rate) || 0);
                const newMaterial = !trading && !row.materialId;

                return (
                  <div
                    key={row.key}
                    className={`rounded-md border p-2.5 md:border-0 md:p-0 ${
                      issue
                        ? "border-brand-clay/50 bg-brand-clay-tint/20 md:bg-transparent"
                        : "border-brand-green-line bg-brand-mist/30 md:bg-transparent"
                    }`}
                  >
                    <input type="hidden" name={`item${index}Kind`} value={row.kind} />
                    {trading ? (
                      <>
                        <input type="hidden" name={`item${index}Design`} value={row.design} />
                        <input type="hidden" name={`item${index}SizeRun`} value={row.sizeRun} />
                      </>
                    ) : (
                      <>
                        <input type="hidden" name={`item${index}MaterialId`} value={row.materialId} />
                        <input type="hidden" name={`item${index}MaterialName`} value={row.materialName} />
                        <input type="hidden" name={`item${index}MaterialUnit`} value={row.materialUnit} />
                      </>
                    )}

                    <div className="grid gap-2 md:grid-cols-[42px_104px_minmax(0,1.5fr)_0.7fr_0.85fr_1fr_40px] md:items-center">
                      {/* Read off the row, never typed: a hand-kept number and
                          the bill it numbers can disagree, and this cannot. */}
                      <div
                        className={`flex h-11 items-center justify-center rounded-md text-sm font-bold tabular-nums ${
                          touched
                            ? "bg-brand-mist text-brand-muted"
                            : "border border-dashed border-brand-green-line text-brand-muted-soft"
                        }`}
                      >
                        {index + 1}
                      </div>

                      <select
                        className={`${cell} ${
                          trading
                            ? "border-brand-green/30 bg-brand-green-wash"
                            : "border-[#EBD9AE] bg-[#FFF9EA]"
                        } text-[13px] font-semibold`}
                        value={row.kind}
                        onChange={(event) => setKind(row, event.target.value as PurchaseKind)}
                        aria-label={text(`Item ${index + 1} kind`, `क्र.सं. ${index + 1} को प्रकार`)}
                      >
                        <option value="Raw Material">{text("Material", "कच्चा")}</option>
                        <option value="Trading Goods">{text("Ready-made", "तयारी")}</option>
                      </select>

                      <input
                        ref={(element) => {
                          boxes.current.set(boxKey(row.key, "item"), element);
                        }}
                        list={trading ? "purchase-designs" : "purchase-materials"}
                        className={fieldClass(Boolean(issue?.design || issue?.material))}
                        placeholder={text("Item name", "सामानको नाम")}
                        value={itemNameOf(row, rawMaterials)}
                        onChange={(event) => setItemName(row, event.target.value)}
                        onKeyDown={(event) => handleWalk(event, index, "item")}
                        aria-label={text(`Item ${index + 1} name`, `क्र.सं. ${index + 1} को सामान`)}
                      />

                      <input
                        ref={(element) => {
                          boxes.current.set(boxKey(row.key, "quantity"), element);
                        }}
                        name={`item${index}Quantity`}
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        className={`${fieldClass(Boolean(issue?.quantity))} text-right tabular-nums`}
                        placeholder={text("Qty", "थान")}
                        value={row.quantity}
                        onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                        onKeyDown={(event) => handleWalk(event, index, "quantity")}
                        aria-label={text(`Item ${index + 1} quantity`, `क्र.सं. ${index + 1} को थान`)}
                      />

                      <input
                        ref={(element) => {
                          boxes.current.set(boxKey(row.key, "rate"), element);
                        }}
                        name={`item${index}Rate`}
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        className={`${fieldClass(Boolean(issue?.rate))} text-right tabular-nums`}
                        placeholder={text("Rate", "दर")}
                        value={row.rate}
                        onChange={(event) => updateRow(row.key, { rate: event.target.value })}
                        onKeyDown={(event) => handleWalk(event, index, "rate")}
                        aria-label={text(`Item ${index + 1} rate`, `क्र.सं. ${index + 1} को दर`)}
                      />

                      {/* Never typed into — quantity times rate, so the line and
                          the bill total cannot tell different stories. */}
                      <div className="flex h-11 items-center justify-end rounded-md bg-brand-mist px-3 text-sm font-bold tabular-nums text-brand-green-ink">
                        {touched ? lineAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : ""}
                      </div>

                      <div className="flex justify-end">
                        {rows.length > 1 ? (
                          <button
                            type="button"
                            onClick={() =>
                              setRows((current) => {
                                const next = current.filter((item) => item.key !== row.key);
                                return next.length > 0 ? next : [emptyRow(nextKey)];
                              })
                            }
                            aria-label={text(`Remove item ${index + 1}`, `क्र.सं. ${index + 1} हटाउने`)}
                            className="flex h-11 w-11 items-center justify-center rounded-md text-brand-muted-soft transition hover:bg-brand-clay-tint hover:text-brand-clay"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {/* What each kind needs beyond the columns every line
                        shares. Only once the line is real: an empty row asking
                        for a size run is noise on a bill nobody has started. */}
                    {touched ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 border-l-2 border-brand-green-line pl-3 md:ml-[46px]">
                        {trading ? (
                          <>
                            <span className="text-[11px] font-bold text-brand-muted-soft">
                              {text("Size run", "साइज")}
                            </span>
                            <input
                              className={`${plain} h-9 w-36 text-[13px]`}
                              placeholder="36-41"
                              value={row.sizeRun}
                              onChange={(event) => updateRow(row.key, { sizeRun: event.target.value })}
                              aria-label={text(`Item ${index + 1} size run`, `क्र.सं. ${index + 1} को साइज`)}
                            />
                            <span className="text-[11px] font-bold text-brand-green">
                              {text("→ straight to sellable stock", "→ सिधै बिक्रीयोग्य स्टकमा")}
                            </span>
                          </>
                        ) : (
                          <>
                            {newMaterial ? (
                              <>
                                <span className="text-[11px] font-bold text-brand-muted-soft">
                                  {text("Unit", "एकाइ")}
                                </span>
                                <select
                                  className={`${plain} h-9 w-28 text-[13px]`}
                                  value={row.materialUnit}
                                  onChange={(event) =>
                                    updateRow(row.key, { materialUnit: event.target.value })
                                  }
                                  aria-label={text(`Item ${index + 1} unit`, `क्र.सं. ${index + 1} को एकाइ`)}
                                >
                                  {rawMaterialUnits.map((unit) => (
                                    <option key={unit} value={unit}>
                                      {unit}
                                    </option>
                                  ))}
                                </select>
                              </>
                            ) : (
                              <span className="text-[11px] font-bold text-brand-muted-soft">
                                {rawMaterials.find((material) => material.id === row.materialId)?.unit}
                              </span>
                            )}
                            <span className="text-[11px] font-bold text-brand-gold-ink">
                              {text("→ to the factory store", "→ कारखानाको भण्डारमा")}
                            </span>
                          </>
                        )}

                        <input
                          name={`item${index}Note`}
                          className={`${plain} h-9 min-w-40 flex-1 text-[13px]`}
                          placeholder={text("Line note (optional)", "लाइनको टिपोट (चाहिए)")}
                          aria-label={text(`Item ${index + 1} note`, `क्र.सं. ${index + 1} को टिपोट`)}
                        />
                      </div>
                    ) : null}

                    {issue ? (
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-brand-clay md:ml-[46px]">
                        <span aria-hidden="true">⚠</span>
                        {issue.message}
                      </p>
                    ) : share && share.lineSubtotal !== share.lineTotal ? (
                      <p className="mt-1.5 text-xs text-brand-muted md:ml-[46px]">
                        {text(
                          `After bill discount and tax ${money(share.lineTotal)}`,
                          `बिलको छुट र करपछि ${money(share.lineTotal)}`,
                        )}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>

            <p className="mt-2 text-xs text-brand-muted">
              {text(
                "A new line appears as you fill the last one. Blank lines are ignored.",
                "अन्तिम लाइन भरिनेबित्तिकै अर्को आफैं देखिन्छ। खाली लाइन गनिँदैन।",
              )}
            </p>
          </section>

          {/* ── How it was paid ──────────────────────────────────────── */}
          <section className="rounded-md border border-brand-green/30 p-3 md:p-4">
            <h3 className="text-sm font-black text-brand-green-ink">
              {text("How it was paid", "कसरी तिर्यो")}
            </h3>

            <div className="mt-3 grid grid-cols-4 gap-2">
              {methods.map((method) => {
                const on = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => chooseMethod(method.id)}
                    className={`flex min-h-[76px] flex-col items-center justify-center gap-1 rounded-lg px-2 py-3 transition ${
                      on
                        ? "border-2 border-brand-green bg-brand-green-wash text-brand-green"
                        : "border border-brand-green-line bg-brand-paper text-brand-muted hover:border-brand-gold"
                    }`}
                  >
                    <svg
                      width="21"
                      height="21"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      {method.icon}
                    </svg>
                    <span className="text-[13px] font-black">{text(method.en, method.ne)}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <label
                  htmlFor="purchase-paid"
                  className="text-[11px] font-black uppercase tracking-[0.12em] text-brand-muted-soft"
                >
                  {text("Paid now", "कति तिर्यो")}
                </label>
                <input
                  id="purchase-paid"
                  name="paidAmount"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  disabled={paymentMethod === "Credit"}
                  className={`${plain} mt-1 w-full text-right text-base font-black tabular-nums disabled:bg-brand-mist disabled:text-brand-muted-soft`}
                  placeholder="0"
                  value={paidAmount}
                  onChange={(event) => setPaidAmount(event.target.value)}
                />
              </div>
              <div>
                <label
                  htmlFor="purchase-reference"
                  className="text-[11px] font-black uppercase tracking-[0.12em] text-brand-muted-soft"
                >
                  {referenceLabel}
                </label>
                <input
                  id="purchase-reference"
                  name="paymentReference"
                  className={`${plain} mt-1 w-full`}
                  placeholder={
                    paymentMethod === "QR" ? "eSewa / Khalti / Fonepay" : text("Reference no.", "रेफरेन्स नं.")
                  }
                />
              </div>
            </div>

            {paymentMethod === "Credit" ? (
              <p className="mt-2 text-xs text-brand-muted">
                {text(
                  "Nothing handed over — the whole bill stays on the supplier's account.",
                  "अहिले केही नतिरेको — पूरै बिल साहुको खातामा उधारो रहन्छ।",
                )}
              </p>
            ) : null}
          </section>
        </div>

        {/* ── What it comes to ───────────────────────────────────────── */}
        <aside className="grid content-start gap-3 rounded-md border border-brand-green-line bg-brand-mist/40 p-4 xl:sticky xl:top-4">
          <h3 className="text-sm font-black text-brand-green-ink">
            {text("What it comes to", "बिलको हिसाब")}
          </h3>

          <dl className="grid gap-2 border-b border-brand-green-line pb-3 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-brand-muted">
                {text(
                  `${totals.lineCount} item${totals.lineCount === 1 ? "" : "s"}`,
                  `${totals.lineCount} सामान`,
                )}
              </dt>
              <dd className="font-semibold tabular-nums text-brand-green-ink">{money(totals.subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-brand-muted">{text("Discount", "छुट")}</dt>
              <dd>
                <input
                  name="discount"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  className={`${plain} h-9 w-24 text-right text-[13px] tabular-nums`}
                  placeholder="0"
                  value={discount}
                  onChange={(event) => setDiscount(event.target.value)}
                  aria-label={text("Bill discount", "बिलको छुट")}
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-brand-muted">{text("Tax / VAT", "कर / VAT")}</dt>
              <dd>
                <input
                  name="tax"
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  className={`${plain} h-9 w-24 text-right text-[13px] tabular-nums`}
                  placeholder="0"
                  value={tax}
                  onChange={(event) => setTax(event.target.value)}
                  aria-label={text("Bill tax", "बिलको कर")}
                />
              </dd>
            </div>
          </dl>

          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm font-black text-brand-green-ink">{text("Bill total", "बिल जम्मा")}</span>
            <span className="text-xl font-black tabular-nums text-brand-green-ink">{money(totals.total)}</span>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-brand-muted">{text("Paid", "तिरेको")}</span>
            <span className="text-sm font-bold tabular-nums text-brand-green">{money(paid)}</span>
          </div>

          {/* The number this whole screen exists to make visible before the
              bill is saved, rather than after. */}
          <div
            className={`rounded-md border p-3 ${
              due > 0
                ? "border-brand-clay/40 bg-brand-clay-tint text-brand-clay"
                : "border-brand-green/30 bg-brand-green-wash text-brand-green"
            }`}
          >
            <p className="text-xs font-black">
              {due > 0 ? text("Still owed", "उधारो रहन्छ") : text("Nothing owed", "पूरै तिरियो")}
            </p>
            <p className="mt-1 text-2xl font-black leading-none tabular-nums">{money(due)}</p>
          </div>

          <textarea
            name="note"
            className="min-h-20 rounded-md border border-brand-green-line bg-brand-paper px-3 py-2 text-sm outline-none focus:border-brand-green"
            placeholder={text(
              "Bill note, vehicle, gate pass, invoice no.",
              "बिलको टिपोट, गाडी, गेट पास, बिल नं.",
            )}
            aria-label={text("Bill note", "बिलको टिपोट")}
          />

          <button
            type="submit"
            disabled={isSaving}
            className="h-12 w-full rounded-full bg-brand-green px-6 text-sm font-black text-white transition hover:bg-brand-green-ink disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? text("Saving…", "राख्दै…") : text("Save purchase", "बिल राख्ने")}
          </button>
          <p className="text-center text-xs leading-5 text-brand-muted">
            {text(
              "One press files the bill, the stock, the supplier's account and the payment.",
              "एकपटक थिच्दा — बिल, स्टक, साहुको खाता र तिरेको पैसा सबै एकैचोटि।",
            )}
          </p>
        </aside>
      </div>

      <div className="mt-4">
        <ActionMessage state={state} linkLabel={text("See purchases below", "तलका किनमेल हेर्ने")} />
      </div>
    </form>
  );
}
