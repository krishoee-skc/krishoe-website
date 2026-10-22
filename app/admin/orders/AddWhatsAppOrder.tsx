"use client";

import { useState, useTransition } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import EnterWalkForm from "@/components/admin/EnterWalkForm";
import { money } from "@/lib/format-money";
import { addWhatsAppOrderAction, type ActionState } from "@/app/admin/actions";

export type WhatsAppOrderShoe = {
  id: string;
  name: string;
  /** Paisa, as the catalog keeps it. */
  priceValue: number;
  sizes: string[];
  colors: string[];
  stock: number;
  sizeStock?: Record<string, number>;
};

type Row = { productId: string; size: string; color: string; quantity: string };

const field =
  "min-h-10 w-full rounded-lg border border-brand-green-line bg-brand-paper px-3 py-2 text-sm text-brand-green-ink focus:border-brand-green focus:outline-none";
const label = "grid gap-1 text-xs font-black text-brand-green-ink";

const emptyRow = (): Row => ({ productId: "", size: "", color: "", quantity: "1" });

/**
 * "Add a WhatsApp order" on the order desk (owner, 2026-10-21): the customer's
 * order typed in by hand, saved as a New order like one from the website.
 */
export default function AddWhatsAppOrder({
  shoes,
  deliveryOptions,
  paymentOptions,
  zones,
}: {
  shoes: WhatsAppOrderShoe[];
  deliveryOptions: string[];
  paymentOptions: string[];
  zones: { id: string; name: string }[];
}) {
  const { text } = useLanguage();
  const [open, setOpen] = useState(false);
  // One key per opened form: a second press of Save returns the same order.
  const [formKey, setFormKey] = useState("");
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [delivery, setDelivery] = useState(deliveryOptions[0] ?? "");
  const [state, setState] = useState<ActionState>({ ok: true, message: "" });
  const [saved, setSaved] = useState("");
  const [isPending, startTransition] = useTransition();

  const shoeById = new Map(shoes.map((shoe) => [shoe.id, shoe]));

  const start = () => {
    setFormKey(crypto.randomUUID());
    setRows([emptyRow()]);
    setDelivery(deliveryOptions[0] ?? "");
    setState({ ok: true, message: "" });
    setSaved("");
    setOpen(true);
  };

  const change = (index: number, patch: Partial<Row>) =>
    setRows((current) => current.map((row, at) => (at === index ? { ...row, ...patch } : row)));

  const pick = (index: number, productId: string) => {
    const shoe = shoeById.get(productId);
    change(index, {
      productId,
      size: "",
      // One colour needs no choosing.
      color: shoe && shoe.colors.length === 1 ? shoe.colors[0] : "",
    });
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    formData.set("formKey", formKey);
    formData.set(
      "items",
      JSON.stringify(
        rows
          .filter((row) => row.productId)
          .map((row) => ({ productId: row.productId, size: row.size, color: row.color, quantity: Number(row.quantity) || 0 })),
      ),
    );
    startTransition(async () => {
      const result = await addWhatsAppOrderAction(state, formData);
      setState(result);
      if (result.ok) {
        setSaved(result.message);
        setOpen(false);
      }
    });
  };

  const totalPaisa = rows.reduce((sum, row) => {
    const shoe = shoeById.get(row.productId);
    return sum + (shoe ? shoe.priceValue * Math.max(0, Math.round(Number(row.quantity) || 0)) : 0);
  }, 0);

  return (
    <div className="contents">
      {!open ? (
        <button
          type="button"
          onClick={start}
          className="order-2 rounded-md bg-brand-green px-3 py-2 text-xs font-black uppercase tracking-wide text-white transition hover:bg-brand-green-ink"
        >
          💬 {text("Add a WhatsApp order", "WhatsApp को अर्डर थप्ने")}
        </button>
      ) : null}
      {saved && !open ? (
        <p role="status" className="order-4 basis-full rounded-lg bg-brand-green-wash px-3 py-2 text-sm font-black text-brand-green">
          ✓ {saved}
        </p>
      ) : null}
      {open ? (
        <EnterWalkForm
          onSubmit={handleSubmit}
          className="order-4 grid basis-full gap-4 rounded-2xl border-2 border-brand-green bg-brand-paper p-4 shadow-sm sm:p-5"
        >
          <p className="text-lg font-black text-brand-green-ink">
            {text("Add a WhatsApp order", "WhatsApp को अर्डर थप्ने")}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              {text("Phone", "फोन")}
              <input name="phone" type="tel" inputMode="tel" required autoComplete="off" className={field} />
            </label>
            <label className={label}>
              {text("Name", "नाम")}
              <input name="name" required maxLength={80} autoComplete="off" className={field} />
            </label>
          </div>
          <label className={label}>
            {text("Address", "ठेगाना")}
            <input name="address" required maxLength={600} autoComplete="off" className={field} />
          </label>

          <div className="grid gap-2 text-sm">
            <div className="hidden gap-2 text-left text-xs font-bold text-brand-muted sm:grid sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_5rem_6rem_6rem_2.5rem]">
              <span>{text("Shoe", "जुत्ता")}</span>
              <span>{text("Size", "साइज")}</span>
              <span>{text("Colour", "रङ")}</span>
              <span>{text("Pairs", "जोडी")}</span>
              <span className="text-right">Rs.</span>
              <span>{text("Stock", "स्टक")}</span>
              <span />
            </div>
                {rows.map((row, index) => {
                  const shoe = shoeById.get(row.productId);
                  const pairs = Math.max(0, Math.round(Number(row.quantity) || 0));
                  const linePaisa = shoe ? shoe.priceValue * pairs : 0;
                  const here = shoe
                    ? shoe.sizeStock && row.size
                      ? shoe.sizeStock[row.size] ?? 0
                      : shoe.stock
                    : null;
                  return (
                    <div key={index} className="grid grid-cols-2 items-center gap-2 border-t border-brand-green-line pt-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_5rem_6rem_6rem_2.5rem]">
                      <div className="col-span-2 sm:col-span-1">
                        <select
                          aria-label={text("Shoe", "जुत्ता")}
                          value={row.productId}
                          onChange={(event) => pick(index, event.target.value)}
                          required
                          className={field}
                        >
                          <option value="">{text("Choose", "छान्नुहोस्")}</option>
                          {shoes.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="">
                        <select
                          aria-label={text("Size", "साइज")}
                          value={row.size}
                          onChange={(event) => change(index, { size: event.target.value })}
                          required
                          disabled={!shoe}
                          className={field}
                        >
                          <option value="">{text("Size", "साइज")}</option>
                          {(shoe?.sizes ?? []).map((size) => (
                            <option key={size} value={size}>
                              {size}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="">
                        <select
                          aria-label={text("Colour", "रङ")}
                          value={row.color}
                          onChange={(event) => change(index, { color: event.target.value })}
                          required={Boolean(shoe?.colors.length)}
                          disabled={!shoe || shoe.colors.length === 0}
                          className={field}
                        >
                          <option value="">{text("Colour", "रङ")}</option>
                          {(shoe?.colors ?? []).map((color) => (
                            <option key={color} value={color}>
                              {color}
                            </option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-xs font-bold text-brand-muted">
                        <span className="sm:hidden">{text("Pairs", "जोडी")}</span>
                        <input
                          aria-label={text("Pairs", "जोडी")}
                          type="number"
                          min={1}
                          max={99}
                          inputMode="numeric"
                          value={row.quantity}
                          onChange={(event) => change(index, { quantity: event.target.value })}
                          required
                          className={field}
                        />
                      </label>
                      <div className="text-right font-black tabular-nums text-brand-green-ink">
                        {shoe ? money(linePaisa / 100) : "—"}
                      </div>
                      <div className="text-xs font-black">
                        {here === null ? (
                          "—"
                        ) : here >= pairs && pairs > 0 ? (
                          <span className="text-emerald-700">✓ {here} {text("here", "छ")}</span>
                        ) : (
                          <span className="text-red-700">{text(`only ${here}`, `${here} मात्र`)}</span>
                        )}
                      </div>
                      <div className="">
                        {rows.length > 1 ? (
                          <button
                            type="button"
                            aria-label={text("Remove this shoe", "यो जुत्ता हटाउने")}
                            onClick={() => setRows((current) => current.filter((_, at) => at !== index))}
                            className="rounded-full px-2 py-1 text-brand-muted hover:text-red-700"
                          >
                            ✕
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setRows((current) => [...current, emptyRow()])}
              className="rounded-full border border-brand-green-line px-3 py-1.5 text-xs font-black text-brand-green-ink hover:border-brand-green"
            >
              + {text("Another shoe", "अर्को जुत्ता")}
            </button>
            <p className="text-sm font-black text-brand-green-ink">
              {text("Shoes", "जुत्ता")}: <span className="tabular-nums">{money(totalPaisa / 100)}</span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className={label}>
              {text("Payment", "भुक्तानी")}
              <select name="payment" required defaultValue={paymentOptions[0]} className={field}>
                {paymentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              {text("Delivery", "डेलिभरी")}
              <select
                name="delivery"
                required
                value={delivery}
                onChange={(event) => setDelivery(event.target.value)}
                className={field}
              >
                {deliveryOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            {zones.length > 0 && delivery !== "Store pickup" ? (
              <label className={label}>
                {text("Delivery area", "डेलिभरी क्षेत्र")}
                <select name="deliveryZone" required defaultValue="" className={field}>
                  <option value="">{text("Choose", "छान्नुहोस्")}</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          <p className="text-xs text-brand-muted">
            {text(
              "Price, stock and the delivery charge are worked out as for a website order. It is saved as 🆕 New.",
              "मूल्य, स्टक र डेलिभरी शुल्क website को अर्डरमा जस्तै हिसाब हुन्छ। यो 🆕 New भएर बस्छ।",
            )}
          </p>

          {state.message && !state.ok ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              {state.message}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-brand-green px-5 py-2 text-sm font-black text-white transition hover:bg-brand-green-ink disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? text("Saving", "बचत हुँदैछ") : text("Save order", "अर्डर बचत गर्ने")}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="rounded-full border border-brand-green-line px-5 py-2 text-sm font-black text-brand-green-ink hover:border-brand-green"
            >
              {text("Cancel", "रद्द")}
            </button>
          </div>
        </EnterWalkForm>
      ) : null}
    </div>
  );
}
