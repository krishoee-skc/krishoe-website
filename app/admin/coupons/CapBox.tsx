"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useLanguage } from "@/components/LanguageProvider";
import { LOW_CAP_RUPEES } from "./cap";

// Only for a percentage code; an amount code has no ceiling.
function isPercent(form: HTMLFormElement) {
  return (form.elements.namedItem("kind") as HTMLSelectElement | null)?.value !== "amount";
}

function percentOf(form: HTMLFormElement) {
  const typed = Number((form.elements.namedItem("percent") as HTMLInputElement | null)?.value);
  return Number.isFinite(typed) && typed > 0 ? typed : 10;
}

/**
 * The most a percentage code may take off, in rupees (owner, 2026-10-21, the
 * coupon sample, 3). BESTOFDASHAIN was saved with "3" — Rs 3 off a Rs 2,000
 * order instead of Rs 200 — and nothing asked. Now a ceiling under Rs 50 is
 * asked about once, on the form, before Save goes.
 */
export default function CapBox({ className, defaultValue = "" }: { className: string; defaultValue?: string }) {
  const { text } = useLanguage();
  const box = useRef<HTMLInputElement>(null);
  const question = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(defaultValue);
  const [asking, setAsking] = useState(false);
  const [yesFor, setYesFor] = useState("");

  const cap = Number(value);
  const low = Number.isFinite(cap) && cap > 0 && cap < LOW_CAP_RUPEES;
  const said = low && yesFor === value;

  const [percent, setPercent] = useState(10);

  useEffect(() => {
    const form = box.current?.form;
    if (!form) return;
    function onSubmit(event: SubmitEvent) {
      if (!form || !low || said || !isPercent(form)) return;
      event.preventDefault();
      setPercent(percentOf(form));
      setAsking(true);
    }
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [low, said]);

  // To the question once it is on screen.
  useEffect(() => {
    if (asking) question.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [asking]);

  const order = 2000;
  const wanted = Math.round((order * percent) / 100);

  return (
    <>
      <span className="flex items-stretch">
        <span className="grid place-items-center rounded-l-xl border border-r-0 border-brand-green-line bg-brand-paper-deep px-3 text-sm font-black text-brand-muted">
          Rs
        </span>
        <input
          ref={box}
          name="maxDiscountRupees"
          type="number"
          min="1"
          placeholder="500"
          aria-label={text("Most a percentage may take off, in rupees", "प्रतिशतमा बढीमा कति छुट, रुपैयाँमा")}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setAsking(false);
          }}
          className={`${className} rounded-l-none`}
        />
      </span>
      <input type="hidden" name="lowCapYes" value={said ? "yes" : ""} />
      {asking && low && !said ? (
        <div ref={question} role="alert" className="grid gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold text-amber-900">
          <p>
            {text(
              `At most Rs ${cap} off — on a Rs ${order.toLocaleString("en-IN")} order that is Rs ${cap}, not Rs ${wanted}. Is that meant?`,
              `बढीमा Rs ${cap} छुट — Rs ${order.toLocaleString("en-IN")} को किनमेलमा छुट Rs ${wanted} होइन, Rs ${cap} मात्र हुन्छ। पक्का हो?`,
            )}
          </p>
          <span className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                // The yes is the Save: the form goes on with it.
                flushSync(() => {
                  setYesFor(value);
                  setAsking(false);
                });
                box.current?.form?.requestSubmit();
              }}
              className="min-h-11 rounded-full bg-brand-green px-4 font-black text-white"
            >
              {text(`Yes, Rs ${cap}`, `हो, Rs ${cap}`)}
            </button>
            <button
              type="button"
              onClick={() => {
                setAsking(false);
                box.current?.focus();
                box.current?.select();
              }}
              className="min-h-11 rounded-full border border-brand-green-line px-4 font-black text-brand-green"
            >
              {text("Change it", "बदल्ने")}
            </button>
          </span>
        </div>
      ) : null}
    </>
  );
}
