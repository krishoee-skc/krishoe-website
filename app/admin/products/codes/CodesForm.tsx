"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { saveProductCodesAction, type CodesState } from "@/app/admin/products/actions";
import { codeProblem, codeTakenBy, tidyCode } from "@/lib/shoe-code";

type Row = {
  id: string;
  name: string;
  category: string;
  group: number;
  current: string;
  suggested: string;
  status: "Active" | "Draft";
};

/**
 * The list the owner reads before any code moves: old code, new code, and
 * what is wrong with a new one while it is typed. Saving asks once more,
 * because a changed code means reprinting that shoe's barcode sticker.
 */
export default function CodesForm({ rows }: { rows: Row[] }) {
  const { text } = useLanguage();
  const router = useRouter();
  const [codes, setCodes] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((row) => [row.id, row.suggested])),
  );
  const [confirming, setConfirming] = useState(false);
  const [state, setState] = useState<CodesState | null>(null);
  const [isSaving, startSaving] = useTransition();

  const after = useMemo(
    () => rows.map((row) => ({ id: row.id, name: row.name, sku: tidyCode(codes[row.id] ?? "") })),
    [rows, codes],
  );
  const changed = rows.filter((row) => tidyCode(codes[row.id] ?? "") !== row.current);

  function problemOf(row: Row) {
    const code = tidyCode(codes[row.id] ?? "");
    const problem = codeProblem(code);
    if (problem === "empty") return text("Empty", "खाली छ");
    if (problem === "looks-like-size") return text("Reads as a size — use 3 digits", "साइज जस्तो — ३ अङ्क राख्नुहोस्");
    const clash = codeTakenBy(after, code, row.id);
    return clash ? text(`Also on ${clash.name}`, `${clash.name} मा पनि छ`) : "";
  }
  const problems = rows.filter((row) => problemOf(row));

  function save() {
    const formData = new FormData();
    for (const row of rows) formData.set(`code:${row.id}`, codes[row.id] ?? "");
    startSaving(async () => {
      const result = await saveProductCodesAction(null, formData);
      setState(result);
      setConfirming(false);
      if (result.ok) router.refresh();
    });
  }

  return (
    <div className="mt-5 grid gap-4">
      <div className="overflow-x-auto rounded-lg border border-brand-green-line bg-brand-paper">
        <table className="reflow-table w-full text-sm md:min-w-[560px]">
          <thead>
            <tr className="text-left text-[11px] font-black uppercase tracking-[0.12em] text-brand-muted">
              <th className="px-3 py-2">{text("Shoe", "जुत्ता")}</th>
              <th className="px-3 py-2">{text("Old code", "पुरानो कोड")}</th>
              <th className="px-3 py-2">{text("New code", "नयाँ कोड")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const code = codes[row.id] ?? "";
              const isChanged = tidyCode(code) !== row.current;
              const problem = problemOf(row);
              return (
                <tr key={row.id} className={`border-t border-brand-green-line ${isChanged ? "bg-brand-gold/10" : ""}`}>
                  <td className="reflow-primary px-3 py-2">
                    <span className="font-bold text-brand-green-ink">{row.name}</span>
                    <span className="block text-xs text-brand-muted">
                      {row.category}
                      {row.status === "Draft" ? ` · ${text("Draft", "ड्राफ्ट")}` : ""}
                    </span>
                  </td>
                  <td data-label={text("Old code", "पुरानो कोड")} className="px-3 py-2 font-mono text-xs text-brand-muted">{row.current || "—"}</td>
                  <td data-label={text("New code", "नयाँ कोड")} className="px-3 py-2">
                    <input
                      value={code}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCodes((current) => ({ ...current, [row.id]: value }));
                        setConfirming(false);
                      }}
                      aria-label={text(`New code for ${row.name}`, `${row.name} को नयाँ कोड`)}
                      aria-invalid={Boolean(problem)}
                      autoCapitalize="characters"
                      spellCheck={false}
                      className={`h-10 w-36 rounded-md border px-2 font-mono font-bold ${
                        problem ? "border-brand-clay bg-brand-clay-tint text-brand-clay" : "border-brand-green-line bg-white text-brand-green-ink"
                      }`}
                    />
                    {problem ? (
                      <span className="block text-xs font-bold text-brand-clay">⚠ {problem}</span>
                    ) : isChanged ? (
                      <span className="block text-xs font-bold text-brand-gold-ink">{text("Will change", "बदलिन्छ")}</span>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="sticky bottom-0 grid gap-2 rounded-lg border border-brand-green-line bg-brand-paper p-3 shadow-sm">
        <p className="text-sm font-bold text-brand-green-ink">
          {text(`${changed.length} of ${rows.length} codes will change.`, `${rows.length} मध्ये ${changed.length} वटा कोड बदलिन्छ।`)}{" "}
          {changed.length ? (
            <span className="font-normal text-brand-muted">
              {text(
                "Old bills keep the old code. Reprint the barcode stickers of the shoes that change.",
                "पुराना बिलमा पुरानै कोड रहन्छ। कोड बदलिएका जुत्ताको barcode स्टिकर फेरि छाप्नुहोस्।",
              )}
            </span>
          ) : null}
        </p>
        {problems.length ? (
          <p className="text-sm font-bold text-brand-clay">
            {text(`Fix ${problems.length} code(s) marked ⚠ first.`, `पहिले ⚠ लागेका ${problems.length} वटा कोड मिलाउनुहोस्।`)}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {confirming ? (
            <>
              <button
                type="button"
                onClick={save}
                disabled={isSaving}
                className="h-11 rounded-full bg-brand-green px-5 text-sm font-black text-white disabled:opacity-60"
              >
                {isSaving
                  ? text("Saving…", "सेभ हुँदैछ…")
                  : text(`Yes, change ${changed.length} codes`, `हो, ${changed.length} वटा कोड बदल्ने`)}
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="h-11 rounded-full border border-brand-green px-5 text-sm font-bold text-brand-green"
              >
                {text("Not yet", "अहिले होइन")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setState(null);
                setConfirming(true);
              }}
              disabled={changed.length === 0 || problems.length > 0}
              className="h-11 rounded-full bg-brand-green px-5 text-sm font-black text-white disabled:opacity-50"
            >
              {text("Save codes", "कोड सेभ गर्ने")}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setCodes(Object.fromEntries(rows.map((row) => [row.id, row.current])));
              setConfirming(false);
            }}
            className="h-11 rounded-full border border-brand-green-line px-4 text-sm font-bold text-brand-muted"
          >
            {text("Keep all old codes", "सबै पुरानै राख्ने")}
          </button>
        </div>
        {state ? (
          <p role="status" className={`text-sm font-bold ${state.ok ? "text-brand-green" : "text-brand-clay"}`}>
            {state.ok
              ? state.changed
                ? text(
                    `✓ ${state.changed} codes changed. Reprint the barcode stickers of those shoes.`,
                    `✓ ${state.changed} वटा कोड बदलियो। ती जुत्ताको barcode स्टिकर फेरि छाप्नुहोस्।`,
                  )
                : text("✓ No code changed.", "✓ कुनै कोड बदलिएन।")
              : state.problem === "clash"
                ? text(
                    `⚠ Code ${state.code} is on both ${state.name} and ${state.other}. Change one.`,
                    `⚠ कोड ${state.code} ${state.name} र ${state.other} दुवैमा पर्‍यो। एउटा बदल्नुहोस्।`,
                  )
                : state.problem === "looks-like-size"
                  ? text(
                      `⚠ ${state.name}: ${state.code} reads as a shoe size. Use three digits.`,
                      `⚠ ${state.name}: ${state.code} साइज जस्तो देखिन्छ। ३ अङ्क राख्नुहोस्।`,
                    )
                  : text(`⚠ The code for ${state.name} is empty.`, `⚠ ${state.name} को कोड खाली छ।`)}
          </p>
        ) : null}
      </div>
    </div>
  );
}
