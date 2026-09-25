"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { uploadBillPhoto } from "@/lib/bill-photo-upload";

type Photo = { url: string; pathname: string };

/**
 * The supplier's paper bill, on the saved purchase bill: the photos kept with
 * it, a way to add one (an old bill, or a page forgotten on the day), and a
 * way to take a wrong one back off. Hidden when printing.
 */
export default function BillPhotos({
  invoiceId,
  photos,
  max,
}: {
  invoiceId: string;
  photos: Photo[];
  max: number;
}) {
  const { text } = useLanguage();
  const router = useRouter();
  const picker = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function add(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMessage("");
    const room = Math.max(0, max - photos.length);
    let failed = "";
    for (const file of [...files].slice(0, room)) {
      const result = await uploadBillPhoto(invoiceId, file);
      if (!result.ok) failed = result.message;
    }
    if (picker.current) picker.current.value = "";
    setBusy(false);
    setMessage(failed || text("Photo kept with the bill.", "फोटो बिलसँग राखियो।"));
    router.refresh();
  }

  async function remove(pathname: string) {
    setBusy(true);
    const response = await fetch(
      `/api/admin/purchasing/${encodeURIComponent(invoiceId)}/photos?pathname=${encodeURIComponent(pathname)}`,
      { method: "DELETE" },
    ).catch(() => null);
    setBusy(false);
    setMessage(response?.ok ? text("Photo removed.", "फोटो हटाइयो।") : text("Could not remove it.", "हटाउन सकिएन।"));
    router.refresh();
  }

  return (
    <section className="mx-auto mt-6 max-w-4xl rounded-lg border border-brand-green-line bg-brand-paper p-5 print:hidden">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-black text-brand-green-ink">
          📷 {text("Supplier's paper bill", "साहुको कागजी बिलको फोटो")}
        </h2>
        {photos.length < max ? (
          <label className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-brand-green px-5 text-sm font-black text-white">
            {busy ? text("Working…", "गर्दैछ…") : `📷 ${text("Add photo", "फोटो थप्ने")}`}
            <input
              ref={picker}
              type="file"
              accept="image/*"
              multiple
              className="sr-only"
              disabled={busy}
              onChange={(event) => void add(event.target.files)}
            />
          </label>
        ) : null}
      </div>
      {photos.length ? (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {photos.map((photo, index) => (
            <figure key={photo.pathname} className="grid gap-1">
              <a href={photo.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md border border-brand-green-line">
                {/* A plain img: the store's address is not one next/image optimises. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.url} alt={text(`Supplier's bill, photo ${index + 1}`, `साहुको बिल, फोटो ${index + 1}`)} className="aspect-[3/4] w-full object-cover" />
              </a>
              <button
                type="button"
                disabled={busy}
                onClick={() => void remove(photo.pathname)}
                className="text-xs font-bold text-brand-clay"
              >
                ✕ {text("Remove", "हटाउने")}
              </button>
            </figure>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-brand-muted">
          {text("No photo yet. Add one of the supplier's bill to keep it with this purchase.", "अहिलेसम्म फोटो छैन। साहुको बिलको फोटो थपेर यो खरिदसँग राख्नुहोस्।")}
        </p>
      )}
      {message ? <p className="mt-3 text-sm font-semibold text-brand-green" role="status">{message}</p> : null}
    </section>
  );
}
