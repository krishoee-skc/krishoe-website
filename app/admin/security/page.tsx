import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security / CCTV | KRISHOE Admin",
};

// A shortcut hub, not a live view: a web page cannot embed these phone cameras'
// feeds, so each card opens the camera's own app (Option 1 the owner chose).
// Static content — no data, loads instantly. The store link shows "Open" for an
// already-installed app, so it is one tap to the live view on a phone.
type CameraApp = {
  emoji: string;
  name: string;
  vendor: string;
  where: string;
  // Play Store search — always valid, and avoids guessing a package id or a
  // deep-link scheme that may not exist on every build of the app.
  href: string;
};

const cameras: CameraApp[] = [
  {
    emoji: "🎥",
    name: "Hik-Connect",
    vendor: "Hikvision",
    where: "पसल / कारखाना",
    href: "https://play.google.com/store/search?q=Hik-Connect&c=apps",
  },
  {
    emoji: "📹",
    name: "V380 Pro",
    vendor: "V380",
    where: "पसल / कारखाना",
    href: "https://play.google.com/store/search?q=V380%20Pro&c=apps",
  },
  {
    emoji: "📷",
    name: "EOQDZI",
    vendor: "EOQDZI",
    where: "पसल / कारखाना",
    href: "https://play.google.com/store/search?q=EOQDZI&c=apps",
  },
];

export default function SecurityPage() {
  return (
    <section className="p-6">
      <div className="max-w-3xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
          सुरक्षा
        </p>
        <h1 className="mt-2 text-2xl font-black text-brand-green-ink">CCTV / क्यामेरा</h1>
        <p className="mt-1 text-sm leading-6 text-gray-500">
          तपाईंका क्यामेरा एकै ठाउँबाट खोल्नुहोस्। तल थिच्दा त्यो क्यामेराको app खुल्छ
          (फोनमा app install भएको हुनुपर्छ)।
        </p>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cameras.map((camera) => (
          <a
            key={camera.name}
            href={camera.href}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-green hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-mist text-2xl">
                {camera.emoji}
              </span>
              <div className="min-w-0">
                <p className="truncate text-lg font-black text-brand-green-ink">{camera.name}</p>
                <p className="text-xs font-semibold text-gray-500">{camera.vendor}</p>
              </div>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-brand-muted-soft">
              📍 {camera.where}
            </p>
            <span className="mt-4 inline-flex items-center justify-center rounded-full bg-brand-green px-4 py-2 text-sm font-black text-white transition group-hover:bg-[#08392C]">
              खोल्नुहोस् ↗
            </span>
          </a>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-base font-black text-amber-900">📲 अझ सजिलो बनाउने</h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-amber-900">
            <li>• फोनमा हरेक क्यामेरा app लाई <b>“Add to Home screen”</b> गर्नुहोस् — एक tap मा खुल्छ।</li>
            <li>• यो page क्यामेरा <b>भित्रै</b> देखाउँदैन — app खोल्ने शर्टकट मात्र हो।</li>
            <li>• क्यामेरा हाम्रो app <b>भित्रै live</b> हेर्न चाहेमा भन्नुहोस् — त्यो अलग (ठूलो) काम हो।</li>
          </ul>
        </div>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-base font-black text-emerald-950">🔒 app-भित्रको सुरक्षा</h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-emerald-900">
            <li>• हरेक कर्मचारीलाई <b>आफ्नै login</b> दिनुहोस् — password नबाँड्नुहोस्।</li>
            <li>• नचाहिनेलाई <b>“Viewer”</b> role राख्नुहोस् (हेर्ने मात्र, बदल्न नमिल्ने)।</li>
            <li>
              • बेलाबेला{" "}
              <Link href="/admin/activity" className="font-black text-emerald-950 underline">
                Activity log
              </Link>{" "}
              हेर्नुहोस् — कसले के गर्‍यो थाहा हुन्छ।
            </li>
          </ul>
        </div>
      </div>

      <p className="mt-6 max-w-3xl text-xs leading-6 text-gray-400">
        सुरक्षाका दुई तह: CCTV ले पसल आँखाले हेर्छ, KRISHOE app ले हरेक बिक्री·स्टक·बाँकी
        रेकर्डमा राख्छ। दुवै सँगै भए सुरक्षा बलियो हुन्छ।
      </p>
    </section>
  );
}
