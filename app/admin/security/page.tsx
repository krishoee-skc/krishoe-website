import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security / CCTV | KRISHOE Admin",
};

type PlatformLink = {
  label: string;
  href: string;
  note: string;
};

type CameraApp = {
  icon: string;
  name: string;
  vendor: string;
  links: PlatformLink[];
};

const cameras: CameraApp[] = [
  {
    icon: "HC",
    name: "Hik-Connect",
    vendor: "Hikvision",
    links: [
      {
        label: "iPhone / iPad",
        href: "https://apps.apple.com/in/app/hik-connect/id1087803190",
        note: "Open in the Apple App Store",
      },
      {
        label: "Android",
        href: "https://play.google.com/store/apps/details?id=com.connect.enduser",
        note: "Open in Google Play",
      },
      {
        label: "Windows / Mac",
        href: "https://www.hikvision.com/en/support/download/software/ivms4200-series/",
        note: "Official iVMS-4200 download page",
      },
    ],
  },
  {
    icon: "V3",
    name: "V380 Pro",
    vendor: "Guangzhou Hongshi",
    links: [
      {
        label: "iPhone / iPad",
        href: "https://apps.apple.com/in/app/v380-pro/id1388988209",
        note: "Open in the Apple App Store",
      },
      {
        label: "Android",
        href: "https://play.google.com/store/apps/details?id=com.macrovideo.v380pro",
        note: "Open in Google Play",
      },
      {
        label: "Windows PC",
        href: "https://v380.org/v380-for-pc/",
        note: "V380 desktop client page",
      },
    ],
  },
];

export default function SecurityPage() {
  return (
    <section className="p-4 pb-28 sm:p-6 sm:pb-10">
      <div className="max-w-4xl">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-green">
          Security centre
        </p>
        <h1 className="mt-2 font-display text-2xl font-black text-brand-green-ink sm:text-3xl">
          CCTV camera apps
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-muted">
          Choose the button for the device you are using. This page opens the camera vendor&apos;s
          app or download page; camera passwords and recordings are not stored in KRISHOE.
        </p>
      </div>

      <div className="mt-6 grid max-w-5xl gap-5 lg:grid-cols-2">
        {cameras.map((camera) => (
          <article key={camera.name} className="rounded-3xl border border-brand-green-line bg-brand-paper p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-brand-green font-black text-white">
                {camera.icon}
              </span>
              <div>
                <h2 className="text-xl font-black text-brand-green-ink">{camera.name}</h2>
                <p className="text-xs font-semibold text-brand-muted">{camera.vendor} · Shop / Factory</p>
              </div>
            </div>

            <div className="mt-5 grid gap-3">
              {camera.links.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-14 items-center justify-between gap-4 rounded-2xl border border-brand-green-line px-4 py-3 transition hover:border-brand-green hover:bg-brand-mist"
                >
                  <span>
                    <span className="block text-sm font-black text-brand-green-ink">{link.label}</span>
                    <span className="block text-xs text-brand-muted">{link.note}</span>
                  </span>
                  <span aria-hidden="true" className="font-black text-brand-green">↗</span>
                </a>
              ))}
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 max-w-5xl rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <h2 className="text-base font-black text-amber-950">EOQDZI camera</h2>
        <p className="mt-2 text-sm leading-6 text-amber-900">
          EOQDZI appears to be the camera/product name, but its required app could not be verified
          safely. Scan the QR code on the camera label or its manual and confirm the exact app name.
          Do not install an app only because it has a similar name.
        </p>
      </div>

      <div className="mt-5 grid max-w-5xl gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border border-brand-green-line bg-brand-green-wash p-5">
          <h2 className="text-base font-black text-brand-green">iPhone मा नखुलेमा</h2>
          <ol className="mt-3 grid list-decimal gap-2 pl-5 text-sm leading-6 text-brand-green">
            <li>माथिको iPhone / iPad बटन Safari मा खोल्नुहोस्।</li>
            <li>App Store मा Get/Open थिच्नुहोस् र Apple ID पुष्टि गर्नुहोस्।</li>
            <li>पहिले Google Play खुलेको थियो भने त्यो Android link भएकाले iPhone मा चल्दैन।</li>
          </ol>
        </div>

        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
          <h2 className="text-base font-black text-emerald-950">KRISHOE account safety</h2>
          <ul className="mt-3 grid gap-2 text-sm leading-6 text-emerald-900">
            <li>हरेक staff लाई आफ्नै login दिनुहोस्; password नबाँड्नुहोस्।</li>
            <li>Camera password KRISHOE staff password भन्दा फरक राख्नुहोस्।</li>
            <li>
              बेलाबेला <Link href="/admin/activity" className="font-black underline">Activity log</Link> र{" "}
              <Link href="/admin/login-devices" className="font-black underline">Login devices</Link> जाँच्नुहोस्।
            </li>
          </ul>
        </div>
      </div>

      <p className="mt-6 max-w-4xl text-xs leading-6 text-brand-muted">
        CCTV ले स्थानको दृश्य सुरक्षा दिन्छ; KRISHOE ले बिक्री, stock, credit र activity records सुरक्षित राख्छ।
        Live camera feed लाई KRISHOE भित्र embed गरिएको छैन।
      </p>
    </section>
  );
}
