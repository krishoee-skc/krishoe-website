"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

const KINDS = [
  { value: "done", label: "✅ काम सकियो" },
  { value: "upper", label: "🧵 माथिल्लो भाग" },
  { value: "ready", label: "👟 तयार जोडी" },
  { value: "problem", label: "⚠️ समस्या / बिग्रियो" },
] as const;

/**
 * Shrink a phone photo before it goes up: the long side to 1600px, as JPEG.
 * A phone shoots 4–12 MB; the server takes 4.5 at most, and a factory floor's
 * data is not fast. Falls back to the original if the browser cannot.
 */
async function shrink(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    return blob ?? file;
  } catch {
    return file;
  }
}

/**
 * The worker's "send a photo of my work" (owner, 2026-10-02): take or pick a
 * photo, say what it is, pairs if they like, a word if they like, and send.
 * It reaches the owner as proof; the books change only when the owner adds it.
 */
export default function WorkerPhotoForm({ disabledReason }: { disabledReason?: string }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [kind, setKind] = useState<string>("done");
  const [pairs, setPairs] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<{ ok: boolean; text: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function pick(next: File | null) {
    setReply(null);
    setFile(next);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(next ? URL.createObjectURL(next) : "");
  }

  async function send() {
    if (!file) return;
    setBusy(true);
    setReply(null);
    try {
      const body = new FormData();
      body.set("photo", await shrink(file), "work.jpg");
      body.set("kind", kind);
      body.set("pairs", pairs);
      body.set("note", note);
      const response = await fetch("/api/worker/photos", { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as { ok?: boolean; ne?: string };
      setReply({ ok: Boolean(data.ok), text: data.ne || (response.ok ? "पठाइयो ✅" : "पठाइएन। फेरि प्रयास गर्नुहोस्।") });
      if (data.ok) {
        pick(null);
        setPairs("");
        setNote("");
        router.refresh();
      }
    } catch {
      setReply({ ok: false, text: "इन्टरनेट मिलेन। फेरि प्रयास गर्नुहोस्।" });
    } finally {
      setBusy(false);
    }
  }

  if (disabledReason) {
    return <p className="rounded-2xl bg-brand-cream-soft px-4 py-4 text-lg font-bold text-brand-green-ink">{disabledReason}</p>;
  }

  return (
    <div className="grid gap-4">
      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        aria-label="कामको फोटो"
        onChange={(event) => pick(event.target.files?.[0] ?? null)}
      />
      <button
        type="button"
        onClick={() => input.current?.click()}
        className="grid min-h-44 place-items-center overflow-hidden rounded-3xl border-2 border-dashed border-brand-green bg-brand-paper text-center text-lg font-black text-brand-green"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="छानिएको फोटो" className="max-h-72 w-full object-contain" />
        ) : (
          <span>📷<br />फोटो खिच्ने<br /><span className="text-base font-semibold text-brand-muted">वा फोनबाट छान्ने</span></span>
        )}
      </button>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-lg font-black">के को फोटो?</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={kind === item.value}
              onClick={() => setKind(item.value)}
              className={`min-h-12 rounded-full border-2 px-4 text-base font-black ${kind === item.value ? "border-brand-green bg-brand-green text-white" : "border-brand-green-line bg-brand-paper text-brand-green-ink"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="grid gap-1 text-lg font-black">
        कति जोडी? <span className="text-base font-semibold text-brand-muted">(नभरे पनि हुन्छ)</span>
        <input value={pairs} onChange={(event) => setPairs(event.target.value)} inputMode="numeric" className="min-h-14 rounded-2xl border-2 border-brand-green-line bg-brand-paper px-4 text-xl" />
      </label>
      <label className="grid gap-1 text-lg font-black">
        केही भन्नु छ? <span className="text-base font-semibold text-brand-muted">(नभरे पनि हुन्छ)</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={300} className="rounded-2xl border-2 border-brand-green-line bg-brand-paper px-4 py-3 text-lg" />
      </label>

      <button
        type="button"
        disabled={!file || busy}
        onClick={() => void send()}
        className="min-h-16 rounded-2xl bg-brand-green px-4 text-xl font-black text-white disabled:opacity-50"
      >
        {busy ? "पठाउँदै…" : "➤ मालिकलाई पठाउने"}
      </button>
      {reply ? (
        <p role="status" className={`rounded-2xl px-4 py-3 text-lg font-black ${reply.ok ? "bg-brand-green-wash text-brand-green" : "bg-red-50 text-red-800"}`}>
          {reply.text}
        </p>
      ) : null}
    </div>
  );
}
