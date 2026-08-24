"use client";

import { useRef } from "react";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * Foot length in centimetres against the EU sizes KRISHOE actually stocks.
 *
 * Derived from the Paris point, which is what EU sizing is: one point is 2/3 cm
 * of last length, and a last runs about 1.5 cm longer than the foot inside it.
 * So foot = size / 1.5 − 1.5, rounded to a millimetre. Working from the
 * definition rather than copying a table means every row here agrees with every
 * other one, and with the sizes on the products.
 */
function footLengthCm(euSize: number) {
  return Math.round((euSize / 1.5 - 1.5) * 10) / 10;
}

export default function SizeGuide({ sizes }: { sizes: string[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { text } = useLanguage();

  const numeric = sizes
    .map((size) => Number(size))
    .filter((size) => Number.isFinite(size) && size > 0)
    .sort((left, right) => left - right);

  if (numeric.length === 0) return null;

  // A child's 26 and an adult's 26 are not the same shoe. The row a customer
  // needs is the one for the pair they are looking at, so the table is built
  // from this product's own sizes rather than showing every size KRISHOE makes.
  const isKids = numeric[0] < 33;

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        className="text-xs font-bold text-brand-green underline underline-offset-4 transition hover:text-brand-gold-deep"
      >
        {text("Size guide", "साइज चार्ट")}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(event) => {
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="w-[min(92vw,26rem)] rounded-2xl p-0 backdrop:bg-black/60"
      >
        <div className="max-h-[85dvh] overflow-y-auto p-5">
          <h2 className="text-xl font-black text-brand-green-ink">
            {text("Find your size", "आफ्नो साइज पत्ता लगाउनुहोस्")}
          </h2>

          <ol className="mt-4 grid gap-2 text-sm leading-6 text-brand-muted">
            <li>
              <strong className="text-brand-green-ink">{text("1.", "१.")}</strong>{" "}
              {text(
                "Put a sheet of paper on the floor against a wall and stand on it, heel touching the wall.",
                "भुइँमा कागज राखेर भित्तामा कुर्कुच्चा टेकाएर उभिनुहोस्।",
              )}
            </li>
            <li>
              <strong className="text-brand-green-ink">{text("2.", "२.")}</strong>{" "}
              {text(
                "Mark the paper at the tip of your longest toe.",
                "सबैभन्दा लामो औँलाको टुप्पोमा चिन्ह लगाउनुहोस्।",
              )}
            </li>
            <li>
              <strong className="text-brand-green-ink">{text("3.", "३.")}</strong>{" "}
              {text(
                "Measure from the wall to the mark in centimetres, and find that number below.",
                "भित्तादेखि चिन्हसम्म सेन्टिमिटरमा नाप्नुहोस्, अनि तल त्यही संख्या खोज्नुहोस्।",
              )}
            </li>
          </ol>

          <div className="mt-4 overflow-hidden rounded-xl border border-black/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-brand-mist text-left">
                  <th className="px-4 py-2 font-black text-brand-green-ink">
                    {text("Size", "साइज")}
                  </th>
                  <th className="px-4 py-2 font-black text-brand-green-ink">
                    {text("Foot length", "खुट्टाको लम्बाइ")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {numeric.map((size) => (
                  <tr key={size} className="border-t border-black/[0.06]">
                    <td className="px-4 py-2 font-black text-brand-green-ink">{size}</td>
                    <td className="px-4 py-2 tabular-nums text-brand-muted">
                      {footLengthCm(size)} cm
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 rounded-xl bg-brand-mist px-3 py-2 text-xs font-semibold leading-5 text-brand-green-ink">
            {text(
              "Between two sizes? Take the larger one. Measure in the evening — feet are slightly wider then.",
              "दुई साइजको बीचमा पर्‍यो? ठूलो लिनुहोस्। बेलुका नाप्नुहोस् — दिनभरि हिँडेपछि खुट्टा अलि ठूलो हुन्छ।",
            )}
          </p>

          {isKids ? (
            <p className="mt-2 rounded-xl border border-brand-gold/40 bg-white px-3 py-2 text-xs font-semibold leading-5 text-brand-green-ink">
              {text(
                "Children's feet grow fast. A finger's width of room at the toe lasts a few months longer.",
                "बच्चाको खुट्टा छिटो बढ्छ। औँलाको अगाडि एक औँला जति ठाउँ छाडे केही महिना बढी टिक्छ।",
              )}
            </p>
          ) : null}

          <p className="mt-3 text-xs leading-5 text-brand-muted">
            {text(
              "Not sure? Message us on WhatsApp with your measurement and we will tell you the size.",
              "अझै अन्योल छ? WhatsApp मा नाप पठाउनुहोस् — हामी साइज भनिदिन्छौँ।",
            )}
          </p>

          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className="mt-4 h-12 w-full rounded-xl bg-brand-green font-black text-white transition hover:bg-brand-green-ink"
          >
            {text("Close", "बन्द गर्ने")}
          </button>
        </div>
      </dialog>
    </>
  );
}
