"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPurchaseInvoiceAction } from "@/app/admin/purchasing/actions";
import { money } from "@/lib/format-money";
import { formatAdminDate } from "@/lib/format-date";
import type { ActionState } from "@/app/admin/actions";
import ActionMessage from "@/components/admin/ActionMessage";
import { useLanguage } from "@/components/LanguageProvider";
import { billTotals, shareBillAcrossLines } from "@/lib/purchase-bill";
import { purchaseLineIssue } from "@/lib/purchase-line-check";
import type { PurchaseKind, SupplierLedger, SupplierPaymentMethod } from "@/lib/purchasing";
import { stockPlaces, type StockPlace } from "@/lib/stock-rules";
import { rateKey, type PurchaseMemory, type RememberedLine } from "@/lib/purchase-memory";
import { SIZE_RUNS, sizesInRun } from "@/lib/shoe-sizes";
import type { RawMaterial } from "@/lib/operations";

type PurchaseInvoiceFormProps = {
  supplierLedgers: SupplierLedger[];
  rawMaterials: RawMaterial[];
  /** Catalog product names. A trading-goods line writes the chosen name into
   *  finished stock, which is what the storefront catalog sync matches
   *  against — so a name typed a second way becomes a second product. */
  productNames: string[];
  /** Pairs on hand per design name, to show "68 in stock" beside a design
   *  suggestion so the buyer sees the shelf before ordering more. */
  productStock: Array<{ name: string; stock: number }>;
  /** Last rates, each supplier's last bill and bill numbers — read back from the
   *  bills already filed (lib/purchase-memory). */
  memory: PurchaseMemory;
  /** The sizes each catalog design is made in, by lower-cased name. */
  designSizes: Record<string, string[]>;
};

/** What the last save filed, shown until the next bill is started. */
type Receipt = {
  supplierName: string;
  billNo: string;
  lines: Array<{ name: string; quantity: string; unit: string; rate: string; sizes: string }>;
  total: number;
  paid: number;
  message: string;
  href: string;
};

/** VAT in Nepal, charged on the bill after its discount. */
const VAT_RATE = 0.13;
/** A rate this far from the last one is worth a second look before saving. */
const RATE_WARN = 0.1;
const DEFAULT_RUN = SIZE_RUNS[SIZE_RUNS.length - 1];

// What a bill is made of, and the order Enter walks it — beside this file,
// because they are rules about the bill rather than the markup.
import {
  FIELD_WALK,
  WALK,
  emptyRow,
  itemNameOf,
  rawMaterialUnits,
  rowIsTouched,
  sameName,
  sizesPayload,
  sizesTotalOf,
  type FormField,
  type ItemRow,
  type WalkField,
} from "@/app/admin/purchasing/_components/purchase-invoice-rules";


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
  productStock,
  memory,
  designSizes,
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

  const [supplierId, setSupplierId] = useState("");
  const [billNo, setBillNo] = useState("");
  // VAT is the owner's choice per bill. It starts on when this supplier's last
  // bill carried tax, which is how a VAT-registered supplier bills every time.
  const [vatOn, setVatOn] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const newBillButton = useRef<HTMLButtonElement>(null);
  // Moving the cursor is decided in a key handler and done after a render, but
  // Enter on its own changes nothing on screen, so there was no render: the
  // cursor only moved with the next key typed — into the wrong box. A tick
  // forces the render the move is waiting for.
  const [, setFocusTick] = useState(0);
  function settle() {
    if (pendingFocus.current) setFocusTick((tick) => tick + 1);
  }

  // Ctrl+S files the bill — a deliberate two-key press, unlike a stray Enter.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      if (!formRef.current || receipt) return;
      event.preventDefault();
      formRef.current.requestSubmit();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [receipt]);

  useEffect(() => {
    if (receipt) newBillButton.current?.focus();
  }, [receipt]);

  const supplier = supplierLedgers.find((ledger) => ledger.id === supplierId);
  const supplierMemory = supplierId ? memory.suppliers[supplierId] : undefined;
  const duplicateBill = Boolean(
    billNo.trim() && supplierMemory?.billNos.includes(billNo.trim().toLowerCase()),
  );

  function chooseSupplier(id: string) {
    setSupplierId(id);
    setSupplierError(false);
    setVatOn(Boolean(id && memory.suppliers[id]?.last?.vat));
  }

  /** The sizes a ready-made line offers: the design's own, else a chosen run. */
  function sizeOptionsFor(row: ItemRow) {
    const known = designSizes[row.design.trim().toLowerCase()];
    if (known?.length) return known;
    const run = SIZE_RUNS.find((candidate) => `${candidate.from}-${candidate.to}` === row.sizeChoice) ?? DEFAULT_RUN;
    return sizesInRun(run);
  }

  function sizeBoxKey(rowKey: number, size: string) {
    return `${rowKey}:size:${size}`;
  }

  /** Stock on hand for a material, the way the factory store counts it. */
  function materialStock(material: RawMaterial) {
    return Math.max(0, material.openingStock + material.received - material.used);
  }

  /** The last rate this item was bought at, if it has been bought before. */
  function lastRateOf(row: ItemRow) {
    if (row.kind === "Raw Material") return row.materialId ? memory.lastRates[rateKey(row.kind, row.materialId)] : undefined;
    return row.design ? memory.lastRates[rateKey(row.kind, row.design)] : undefined;
  }

  /** A remembered line, as a row of this form. */
  function rowFromMemory(line: RememberedLine, key: number): ItemRow {
    const base = emptyRow(key);
    if (line.kind === "Trading Goods") {
      return {
        ...base,
        kind: "Trading Goods",
        design: line.design,
        sizeRun: line.sizeRun || "Mixed",
        sizes: Object.fromEntries(Object.entries(line.sizes).map(([size, pairs]) => [size, String(pairs)])),
        quantity: Object.keys(line.sizes).length ? String(line.quantity) : "",
        rate: String(line.rate),
      };
    }
    const known = rawMaterials.find((material) => material.id === line.materialId);
    return {
      ...base,
      materialId: known?.id ?? "",
      materialName: known ? "" : line.itemName,
      materialUnit: known?.unit ?? line.unit,
      quantity: String(line.quantity),
      rate: String(line.rate),
    };
  }

  /** The supplier's last bill, again — a regular order in one press. */
  function repeatLastBill() {
    const last = supplierMemory?.last;
    if (!last?.lines.length) return;
    setRows((current) => {
      const kept = current.filter(rowIsTouched);
      const repeated = last.lines.map((line, offset) => rowFromMemory(line, nextKey + offset));
      return [...kept, ...repeated, emptyRow(nextKey + repeated.length)];
    });
    setNextKey((value) => value + last.lines.length + 1);
  }

  function boxKey(rowKey: number, field: WalkField) {
    return `${rowKey}:${field}`;
  }

  /**
   * Enter and Shift+Enter along the boxes outside the item table.
   *
   * Three rules, and the first is the one that matters: Enter never saves the
   * bill. In a browser Enter in a text box submits the form, and a half-typed
   * purchase filed by a mis-hit is worse than any amount of saved keystrokes —
   * so every path here calls preventDefault, and the last box simply stops.
   * The Save button remains the only way a bill is filed.
   *
   * Shift+Enter walks back, because a shopkeeper who has overshot a box should
   * not have to reach for the mouse to correct it. Tab is untouched and still
   * works for anyone who has that habit.
   */
  function handleFieldWalk(event: React.KeyboardEvent<HTMLInputElement>, field: FormField) {
    if (event.key !== "Enter") return;
    event.preventDefault();

    const at = FIELD_WALK.indexOf(field);

    if (event.shiftKey) {
      // Backwards out of the discount lands on the last line's rate, the box
      // the forward walk arrived from.
      if (field === "discount" && rows.length > 0) {
        pendingFocus.current = boxKey(rows[rows.length - 1].key, "rate");
        return;
      }
      if (at > 0) pendingFocus.current = FIELD_WALK[at - 1];
      return;
    }

    // The bill number is the last box before the goods: drop into line one.
    if (field === "supplierBillNo" && rows.length > 0) {
      pendingFocus.current = boxKey(rows[0].key, "item");
      return;
    }

    // The reference is the last box on the walk, and the walk simply stops
    // there. The note below it is a textarea, where Enter has to keep meaning
    // "new line" — a vehicle number and a gate pass belong on separate lines.
    if (at < FIELD_WALK.length - 1) {
      pendingFocus.current = FIELD_WALK[at + 1];
    } else {
      // The last box hands over to the Save button — which another deliberate
      // Enter presses. Enter itself still never files the bill.
      saveButton.current?.focus();
    }
  }

  function handleWalk(event: React.KeyboardEvent<HTMLInputElement>, index: number, field: WalkField) {
    if (event.key !== "Enter") return;
    // Enter in a form submits it. Here it means "next box", which is what it
    // means on every bill book this shop has ever used.
    event.preventDefault();

    const at = WALK.indexOf(field);
    const tradingRow = rows[index].kind === "Trading Goods";

    // Shift+Enter retraces the forward walk exactly: back along the row, up to
    // the previous row's rate, and out of the first item box to the bill
    // number it came from.
    if (event.shiftKey && tradingRow && field === "rate") {
      const sizes = sizeOptionsFor(rows[index]);
      pendingFocus.current = sizeBoxKey(rows[index].key, sizes[sizes.length - 1]);
      return;
    }
    if (event.shiftKey) {
      if (at > 0) {
        pendingFocus.current = boxKey(rows[index].key, WALK[at - 1]);
        return;
      }
      const previousRow = rows[index - 1];
      pendingFocus.current = previousRow ? boxKey(previousRow.key, "rate") : "supplierBillNo";
      return;
    }

    // A ready-made line has no quantity to type — its sizes add up to it — so
    // the item box leads to the first size, and the sizes lead to the rate.
    if (tradingRow && field === "item") {
      pendingFocus.current = sizeBoxKey(rows[index].key, sizeOptionsFor(rows[index])[0]);
      return;
    }

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

    // Enter on the rate of an untouched last row means the goods are finished.
    // Growing another empty line here would leave the cursor circling in a row
    // nobody is going to type into; the discount is what comes next on the
    // bill, so go there instead.
    if (!rowIsTouched(rows[index])) {
      pendingFocus.current = "discount";
      return;
    }

    const grownKey = nextKey;
    setRows((current) => [...current, emptyRow(grownKey)]);
    setNextKey((value) => value + 1);
    pendingFocus.current = boxKey(grownKey, "item");
  }

  /** Enter along a ready-made line's size boxes, then on to its rate. */
  function handleSizeWalk(event: React.KeyboardEvent<HTMLInputElement>, index: number, sizeIndex: number) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const row = rows[index];
    const sizes = sizeOptionsFor(row);
    if (event.shiftKey) {
      pendingFocus.current = sizeIndex > 0 ? sizeBoxKey(row.key, sizes[sizeIndex - 1]) : boxKey(row.key, "item");
      return;
    }
    pendingFocus.current =
      sizeIndex < sizes.length - 1 ? sizeBoxKey(row.key, sizes[sizeIndex + 1]) : boxKey(row.key, "rate");
  }

  function setSize(row: ItemRow, size: string, value: string) {
    const sizes = { ...row.sizes, [size]: value };
    const total = sizesTotalOf({ sizes });
    updateRow(row.key, { sizes, quantity: total ? String(total) : "" });
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

    const noSizes = started.findIndex((row) => row.kind === "Trading Goods" && sizesTotalOf(row) === 0);
    if (noSizes !== -1) {
      setState({
        ok: false,
        message: text(
          `Item ${noSizes + 1}: enter the pairs by size.`,
          `क्र.सं. ${noSizes + 1}: साइजअनुसार जोडी लेख्नुहोस्।`,
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

    const filed: Receipt = {
      supplierName: supplier?.supplierName || String(formData.get("supplierName") ?? ""),
      billNo,
      lines: started.map((row) => ({
        name: itemNameOf(row, rawMaterials),
        quantity: row.quantity,
        unit: row.kind === "Trading Goods" ? text("pairs", "जोडी") : row.materialUnit,
        rate: row.rate,
        sizes: Object.entries(sizesPayload(row))
          .map(([size, pairs]) => `${size}×${pairs}`)
          .join(", "),
      })),
      total: totals.total,
      paid,
      message: "",
      href: "",
    };

    startSaving(async () => {
      const result = await createPurchaseInvoiceAction(state, formData);
      setState(result);
      if (result.ok) setReceipt({ ...filed, message: result.message, href: result.href ?? "" });

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
        setSupplierId("");
        setBillNo("");
        setVatOn(false);
        formRef.current?.reset();
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
    // One box for both kinds: the name says which it is. A material on the
    // books makes a raw line, a catalog design a ready-made one; a name on
    // neither keeps the line's kind and asks (the chips under the line).
    const material = rawMaterials.find((candidate) => sameName(candidate.name, value));
    const design = material ? undefined : productNames.find((name) => sameName(name, value));

    if (material) {
      const last = memory.lastRates[rateKey("Raw Material", material.id)];
      updateRow(row.key, {
        kind: "Raw Material",
        materialId: material.id,
        materialName: "",
        materialUnit: material.unit,
        design: "",
        rate: row.rate || (last ? String(last.rate) : ""),
      });
      return;
    }

    if (design) {
      const last = memory.lastRates[rateKey("Trading Goods", design)];
      updateRow(row.key, {
        kind: "Trading Goods",
        design,
        materialId: "",
        materialName: "",
        // The run it was last filed under, so the pairs join the same stock row.
        sizeRun: last?.sizeRun || row.sizeRun || "Mixed",
        rate: row.rate || (last ? String(last.rate) : ""),
      });
      return;
    }

    if (row.kind === "Trading Goods") {
      updateRow(row.key, { design: value });
      return;
    }
    updateRow(row.key, { materialId: "", materialName: value });
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
  const goodsTotal = rows
    .filter(rowIsTouched)
    .reduce((sum, row) => sum + (Number(row.quantity) || 0) * (Number(row.rate) || 0), 0);
  const vatAmount = Math.round(Math.max(0, goodsTotal - (Number(discount) || 0)) * VAT_RATE);
  // With VAT on, the tax is 13% worked out, not typed; off, the box is free.
  const effectiveTax = vatOn ? vatAmount : Number(tax) || 0;

  const billLines = rows.filter(rowIsTouched).map((row) => ({
    quantity: Number(row.quantity) || 0,
    rate: Number(row.rate) || 0,
  }));
  const totals = {
    lineCount: billLines.length,
    ...billTotals(billLines, { discount: Number(discount) || 0, tax: effectiveTax }),
    shares: shareBillAcrossLines(billLines, {
      discount: Number(discount) || 0,
      tax: effectiveTax,
    }),
  };

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
      ref={formRef}
      onSubmit={handleSubmit}
      className="rounded-lg border border-brand-green-line bg-brand-paper p-4 shadow-sm md:p-5"
    >
      {/* The server reads item0..itemN-1, so it has to know how many rows were
          rendered rather than guessing a maximum. */}
      <input type="hidden" name="itemCount" value={rows.length} />
      <input type="hidden" name="paymentMethod" value={paymentMethod} />
      {/* One list for both kinds, so the buyer types what is on the paper bill
          and the name decides the kind. Each suggestion says what it is, how
          much is on hand, and what it cost last time. */}
      <datalist id="purchase-items">
        {rawMaterials.map((material) => {
          const last = memory.lastRates[rateKey("Raw Material", material.id)];
          return (
            <option
              key={material.id}
              value={material.name}
              label={`${text("Material", "कच्चा माल")} · ${materialStock(material)} ${material.unit}${
                last ? ` · ${text("last", "पछिल्लो")} ${money(last.rate)}` : ""
              }`}
            />
          );
        })}
        {productStock.map(({ name, stock }) => {
          const last = memory.lastRates[rateKey("Trading Goods", name)];
          return (
            <option
              key={name}
              value={name}
              label={`${text("Ready-made", "तयार जुत्ता")} · ${stock} ${text("pairs", "जोडी")}${
                last ? ` · ${text("last", "पछिल्लो")} ${money(last.rate)}` : ""
              }`}
            />
          );
        })}
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
                value={supplierId}
                aria-label={text("Supplier", "साहु")}
                onChange={(event) => chooseSupplier(event.target.value)}
              >
                <option value="">{text("＋ New supplier (type name)", "＋ नयाँ साहु (नाम लेख्ने)")}</option>
                {supplierLedgers.map((ledger) => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.supplierName}
                    {ledger.balanceDue > 0 ? ` — ${text("owed", "बाँकी")} ${money(ledger.balanceDue)}` : ""}
                  </option>
                ))}
              </select>
              <input aria-label="New supplier name"
                name="supplierName"
                ref={(element) => {
                  boxes.current.set("supplierName", element);
                }}
                onKeyDown={(event) => {
                  handleFieldWalk(event, "supplierName");
                  settle();
                }}
                className={fieldClass(supplierError)}
                placeholder={text("New supplier name", "नयाँ साहुको नाम")}
                onChange={() => setSupplierError(false)}
              />
              <input aria-label="Supplier phone"
                name="phone"
                ref={(element) => {
                  boxes.current.set("phone", element);
                }}
                onKeyDown={(event) => {
                  handleFieldWalk(event, "phone");
                  settle();
                }}
                className={plain}
                placeholder={text("Supplier phone", "साहुको फोन")}
              />
            </div>
            {supplier ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                {supplier.balanceDue > 0 ? (
                  <span className="rounded-full bg-brand-clay-tint px-2.5 py-1 font-black text-brand-clay">
                    {text(`Already owed ${money(supplier.balanceDue)}`, `पहिलेको बाँकी ${money(supplier.balanceDue)}`)}
                  </span>
                ) : null}
                {supplierMemory?.last ? (
                  <>
                    <span className="text-brand-muted">
                      {text("Last bill", "पछिल्लो बिल")}
                      {supplierMemory.last.billNo ? ` ${supplierMemory.last.billNo}` : ""} ·{" "}
                      {formatAdminDate(supplierMemory.last.createdAt)}
                    </span>
                    <button
                      type="button"
                      onClick={repeatLastBill}
                      className="rounded-full border border-brand-green-line bg-brand-paper px-3 py-1 font-black text-brand-green-ink transition hover:border-brand-green"
                    >
                      🔁 {text("Repeat last bill", "पछिल्लो बिल दोहोर्‍याउने")}
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}
            {supplierError ? (
              <p className="mt-1.5 text-xs font-semibold text-brand-clay">
                {text(
                  "Pick a supplier above, or type a new supplier name.",
                  "माथिबाट साहु छान्नुहोस्, वा नयाँ नाम लेख्नुहोस्।",
                )}
              </p>
            ) : null}

            {/* The number printed on the supplier's own bill — theirs, not the
                KR-PUR- one this shop generates. It is the number they quote:
                "the payment for bill 4521". Until now it had to be squeezed
                into the note along with the vehicle and the gate pass, where
                it could not be searched or matched against.

                Optional on purpose: small suppliers here often hand goods over
                with no printed bill, and requiring it would mean a real
                delivery could not be recorded at all. */}
            <label className="mt-3 block">
              <span className="text-xs font-bold text-brand-muted">
                {text("Supplier's bill no.", "साहुको बिल नं.")}
              </span>
              <input
                name="supplierBillNo"
                ref={(element) => {
                  boxes.current.set("supplierBillNo", element);
                }}
                onKeyDown={(event) => {
                  handleFieldWalk(event, "supplierBillNo");
                  settle();
                }}
                value={billNo}
                onChange={(event) => setBillNo(event.target.value)}
                maxLength={60}
                className={`${plain} mt-1`}
                placeholder={text("As printed on their bill — optional", "साहुको बिलमा जे छ — नभए खाली")}
              />
            </label>
            {/* A warning, not a refusal: a supplier can restart their numbers
                each year, and a real bill must never be impossible to enter. */}
            {duplicateBill ? (
              <p className="mt-1.5 rounded-md bg-brand-clay-tint px-2.5 py-1.5 text-xs font-black text-brand-clay">
                ⚠{" "}
                {text(
                  `Bill ${billNo.trim()} from this supplier is already entered. Check it is not the same bill.`,
                  `यो साहुको बिल नं. ${billNo.trim()} पहिल्यै दर्ता छ। उही बिल त होइन, हेर्नुहोस्।`,
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

            {/* Every track is minmax(0, …): a bare "0.7fr" keeps an input's own
                width as its minimum, and the item box — the one that matters —
                was squeezed to a sliver beside three roomy number boxes. */}
            <div className="mt-2 hidden gap-2 px-1 text-[10px] font-black uppercase tracking-[0.12em] text-brand-muted-soft md:grid md:grid-cols-[42px_minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1fr)_40px]">
              <span>{text("S.N.", "क्र.सं.")}</span>
              <span>{text("Item — material or ready-made", "सामान — कच्चा माल वा तयार जुत्ता")}</span>
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
                        <input type="hidden" name={`item${index}Sizes`} value={JSON.stringify(sizesPayload(row))} />
                        <input type="hidden" name={`item${index}Place`} value={row.place} />
                      </>
                    ) : (
                      <>
                        <input type="hidden" name={`item${index}MaterialId`} value={row.materialId} />
                        <input type="hidden" name={`item${index}MaterialName`} value={row.materialName} />
                        <input type="hidden" name={`item${index}MaterialUnit`} value={row.materialUnit} />
                      </>
                    )}

                    <div className="grid gap-2 md:grid-cols-[42px_minmax(0,2.2fr)_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,1fr)_40px] md:items-center">
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


                      <input
                        ref={(element) => {
                          boxes.current.set(boxKey(row.key, "item"), element);
                        }}
                        list="purchase-items"
                        className={fieldClass(Boolean(issue?.design || issue?.material))}
                        placeholder={text("Type the item — leather, sole, sandal…", "सामान टाइप गर्नुहोस् — छाला, सोल, चप्पल…")}
                        value={itemNameOf(row, rawMaterials)}
                        onChange={(event) => setItemName(row, event.target.value)}
                        onKeyDown={(event) => {
                          handleWalk(event, index, "item");
                          settle();
                        }}
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
                        className={`${fieldClass(Boolean(issue?.quantity))} text-right tabular-nums ${trading ? "bg-brand-mist" : ""}`}
                        placeholder={trading ? text("sizes ↓", "साइज ↓") : text("Qty", "थान")}
                        value={row.quantity}
                        // A ready-made line's quantity is its sizes added up.
                        readOnly={trading}
                        onChange={(event) => updateRow(row.key, { quantity: event.target.value })}
                        onKeyDown={(event) => {
                          handleWalk(event, index, "quantity");
                          settle();
                        }}
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
                        onKeyDown={(event) => {
                          handleWalk(event, index, "rate");
                          settle();
                        }}
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
                            {/* Pairs by size — required, and the quantity is their
                                total. Enter walks the sizes and then the rate. */}
                            <div className="flex w-full flex-wrap items-end gap-1.5">
                              <span className="w-full text-[11px] font-bold text-brand-muted-soft">
                                {text("Pairs by size (required)", "साइजअनुसार जोडी (अनिवार्य)")}
                                {sizesTotalOf(row) > 0 ? (
                                  <span className="ml-2 font-black text-brand-green-ink">
                                    {text(`= ${sizesTotalOf(row)} pairs`, `= ${sizesTotalOf(row)} जोडी`)}
                                  </span>
                                ) : null}
                              </span>
                              {sizeOptionsFor(row).map((size, sizeIndex) => (
                                <label key={size} className="grid w-12 gap-0.5 text-center text-[11px] font-black text-brand-muted">
                                  {size}
                                  <input
                                    ref={(element) => {
                                      boxes.current.set(sizeBoxKey(row.key, size), element);
                                    }}
                                    type="number"
                                    min="0"
                                    step="1"
                                    inputMode="numeric"
                                    className={`${plain} h-10 w-12 px-1 text-center tabular-nums`}
                                    value={row.sizes[size] ?? ""}
                                    onChange={(event) => setSize(row, size, event.target.value)}
                                    onKeyDown={(event) => {
                                      handleSizeWalk(event, index, sizeIndex);
                                      settle();
                                    }}
                                    aria-label={text(`Item ${index + 1}, size ${size}`, `क्र.सं. ${index + 1}, साइज ${size}`)}
                                  />
                                </label>
                              ))}
                              {designSizes[row.design.trim().toLowerCase()] ? null : (
                                <span className="flex gap-1 pb-1">
                                  {SIZE_RUNS.map((run) => {
                                    const value = `${run.from}-${run.to}`;
                                    const on = (row.sizeChoice ?? `${DEFAULT_RUN.from}-${DEFAULT_RUN.to}`) === value;
                                    return (
                                      <button
                                        key={value}
                                        type="button"
                                        aria-pressed={on}
                                        onClick={() => updateRow(row.key, { sizeChoice: value, sizes: {}, quantity: "" })}
                                        className={`rounded-full border px-2 py-1 text-[11px] font-black ${
                                          on ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line text-brand-muted"
                                        }`}
                                      >
                                        {text(run.en, run.ne)} {run.from}–{run.to}
                                      </button>
                                    );
                                  })}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-brand-muted-soft">
                              {text("Put where", "कहाँ राख्ने")}
                            </span>
                            <select
                              className={`${plain} h-9 w-32 text-[13px]`}
                              value={row.place}
                              onChange={(event) =>
                                updateRow(row.key, { place: event.target.value as StockPlace })
                              }
                              aria-label={text(
                                `Item ${index + 1} place`,
                                `क्र.सं. ${index + 1} कहाँ राख्ने`,
                              )}
                            >
                              {stockPlaces.map((stockPlace) => (
                                <option key={stockPlace} value={stockPlace}>
                                  {stockPlace === "Factory"
                                    ? text("Factory", "कारखाना")
                                    : text("Shop", "पसल")}
                                </option>
                              ))}
                            </select>
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

                        {!row.materialId && !productNames.some((name) => sameName(name, row.design || row.materialName)) &&
                        (row.materialName || row.design) ? (
                          <span className="flex w-full flex-wrap items-center gap-1.5 text-[11px] font-bold text-brand-muted">
                            {text("New item — what is it?", "नयाँ सामान — यो के हो?")}
                            {(["Raw Material", "Trading Goods"] as const).map((kind) => (
                              <button
                                key={kind}
                                type="button"
                                aria-pressed={row.kind === kind}
                                onClick={() => setKind(row, kind)}
                                className={`rounded-full border px-2.5 py-1 font-black ${
                                  row.kind === kind
                                    ? "border-brand-green bg-brand-green text-white"
                                    : "border-brand-green-line bg-brand-paper text-brand-green-ink"
                                }`}
                              >
                                {kind === "Raw Material" ? text("🧵 Material", "🧵 कच्चा माल") : text("👟 Ready-made shoe", "👟 तयार जुत्ता")}
                              </button>
                            ))}
                          </span>
                        ) : null}

                        {(() => {
                          const last = lastRateOf(row);
                          const rate = Number(row.rate) || 0;
                          if (!last || !rate || Math.abs(rate - last.rate) / last.rate <= RATE_WARN) {
                            return last && !rate ? null : last ? (
                              <span className="w-full text-[11px] font-bold text-brand-muted">
                                {text(`Last rate ${money(last.rate)}`, `पछिल्लो दर ${money(last.rate)}`)}
                              </span>
                            ) : null;
                          }
                          const change = Math.round(((rate - last.rate) / last.rate) * 100);
                          return (
                            <span className="w-full rounded-md bg-brand-clay-tint px-2 py-1 text-[11px] font-black text-brand-clay">
                              ⚠{" "}
                              {change > 0
                                ? text(`${change}% dearer than last time (${money(last.rate)})`, `पछिल्लो दर (${money(last.rate)}) भन्दा ${change}% महँगो`)
                                : text(`${-change}% cheaper than last time (${money(last.rate)})`, `पछिल्लो दर (${money(last.rate)}) भन्दा ${-change}% सस्तो`)}
                            </span>
                          );
                        })()}

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
                ref={(element) => {
                  boxes.current.set("paidAmount", element);
                }}
                onKeyDown={(event) => {
                  handleFieldWalk(event, "paidAmount");
                  settle();
                }}
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
                ref={(element) => {
                  boxes.current.set("paymentReference", element);
                }}
                onKeyDown={(event) => {
                  handleFieldWalk(event, "paymentReference");
                  settle();
                }}
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
                ref={(element) => {
                  boxes.current.set("discount", element);
                }}
                onKeyDown={(event) => {
                  handleFieldWalk(event, "discount");
                  settle();
                }}
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
              <dt className="flex items-center gap-2 text-brand-muted">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    role="switch"
                    checked={vatOn}
                    onChange={(event) => setVatOn(event.target.checked)}
                    className="h-4 w-4 accent-brand-green"
                  />
                  {text("VAT 13%", "VAT १३%")}
                </label>
              </dt>
              <dd>
                <input
                  name="tax"
                ref={(element) => {
                  boxes.current.set("tax", element);
                }}
                onKeyDown={(event) => {
                  handleFieldWalk(event, "tax");
                  settle();
                }}
                  type="number"
                  min="0"
                  step="any"
                  inputMode="decimal"
                  className={`${plain} h-9 w-24 text-right text-[13px] tabular-nums ${vatOn ? "bg-brand-mist" : ""}`}
                  placeholder="0"
                  value={vatOn ? String(vatAmount) : tax}
                  readOnly={vatOn}
                  onChange={(event) => setTax(event.target.value)}
                  aria-label={text("Bill tax", "बिलको कर")}
                />
              </dd>
            </div>
          </dl>
          {vatOn && supplierMemory?.last?.vat ? (
            <p className="-mt-1 text-[11px] font-bold text-brand-green">
              {text(
                "On because this supplier's last bill had VAT. Switch off if this one has none.",
                "यो साहुको पछिल्लो बिलमा VAT थियो, त्यसैले आफैँ खुला भयो। यसमा छैन भने बन्द गर्नुहोस्।",
              )}
            </p>
          ) : null}

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
            {supplier ? (
              <p className="mt-2 text-xs font-bold">
                {text(
                  `${supplier.supplierName}'s account: ${money(supplier.balanceDue)} → ${money(supplier.balanceDue + due)}`,
                  `${supplier.supplierName} को खाता: ${money(supplier.balanceDue)} → ${money(supplier.balanceDue + due)}`,
                )}
              </p>
            ) : null}
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
            ref={saveButton}
            type="submit"
            disabled={isSaving}
            className="hidden h-12 w-full rounded-full bg-brand-green px-6 text-sm font-black text-white transition hover:bg-brand-green-ink focus-visible:ring-4 focus-visible:ring-brand-gold-bright disabled:cursor-not-allowed disabled:opacity-60 md:block"
          >
            {isSaving ? text("Saving…", "राख्दै…") : text("Save purchase", "बिल राख्ने")}
            <span className="ml-2 text-xs font-semibold opacity-75">Ctrl+S</span>
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
        {receipt ? null : <ActionMessage state={state} linkLabel={text("See purchases below", "तलका किनमेल हेर्ने")} />}
      </div>

      {/* On a phone the total and Save sat at the foot of a very long form.
          This keeps them in reach, above the admin's bottom bar. */}
      <div className="sticky bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-20 -mx-4 mt-4 flex items-center justify-between gap-3 border-t border-brand-green-line bg-brand-paper/95 px-4 py-3 backdrop-blur md:hidden">
        <div className="grid leading-tight">
          <span className="text-[11px] font-bold text-brand-muted">{text("Bill total", "बिल जम्मा")}</span>
          <span className="text-lg font-black tabular-nums text-brand-green-ink">{money(totals.total)}</span>
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="h-12 min-w-40 rounded-full bg-brand-green px-6 text-sm font-black text-white disabled:opacity-60"
        >
          {isSaving ? text("Saving…", "राख्दै…") : text("Save purchase", "बिल राख्ने")}
        </button>
      </div>

      {/* After saving: the bill as filed, then the next one or a print. */}
      {receipt ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-label={text("Bill saved", "बिल सेभ भयो")}>
          <div className="grid w-full max-w-md gap-3 rounded-2xl bg-brand-paper p-5 shadow-2xl">
            <h3 className="text-lg font-black text-brand-green-ink">✅ {text("Bill saved", "बिल सेभ भयो")}</h3>
            <p className="text-xs text-brand-muted">{receipt.message}</p>
            <div className="grid gap-1 rounded-lg border border-dashed border-brand-green-line p-3 text-sm">
              <p className="font-black text-brand-green-ink">
                {receipt.supplierName}
                {receipt.billNo ? ` · ${text("bill", "बिल नं.")} ${receipt.billNo}` : ""}
              </p>
              {receipt.lines.map((line, index) => (
                <div key={index} className="flex justify-between gap-3 border-b border-dotted border-brand-green-line py-1">
                  <span>
                    {index + 1}. {line.name}
                    <span className="block text-xs text-brand-muted">
                      {line.quantity} {line.unit} × {money(Number(line.rate) || 0)}
                      {line.sizes ? ` · ${line.sizes}` : ""}
                    </span>
                  </span>
                  <span className="font-bold tabular-nums">{money((Number(line.quantity) || 0) * (Number(line.rate) || 0))}</span>
                </div>
              ))}
              <p className="flex justify-between pt-1 font-black">
                <span>{text("Bill total", "बिल जम्मा")}</span>
                <span className="tabular-nums">{money(receipt.total)}</span>
              </p>
              <p className="flex justify-between text-xs text-brand-muted">
                <span>{text("Paid", "तिरेको")}</span>
                <span className="tabular-nums">{money(receipt.paid)}</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                ref={newBillButton}
                type="button"
                onClick={() => {
                  setReceipt(null);
                  setState(null);
                }}
                className="h-12 rounded-full bg-brand-green text-sm font-black text-white"
              >
                ➕ {text("New bill", "नयाँ बिल")}
              </button>
              {receipt.href ? (
                <a
                  href={receipt.href}
                  className="flex h-12 items-center justify-center rounded-full border border-brand-green-line text-sm font-black text-brand-green-ink"
                >
                  🖨️ {text("See / print", "हेर्ने / प्रिन्ट")}
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </form>
  );
}
