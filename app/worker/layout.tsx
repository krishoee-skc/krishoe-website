import type { Metadata } from "next";

/**
 * The worker portal installs as its own app: a green "कामदार" icon that opens
 * the worker sign-in, not the shop.
 *
 * Every page named the shop's manifest, so a worker who added the portal to
 * the home screen got the shop's black crest, and tapping it opened the shop —
 * the one place a worker was not going. This manifest has its own id, so it
 * installs beside the shop app rather than replacing it, and scope "/" so the
 * first sign-in's password change (/admin/change-password) stays inside the
 * app window instead of dropping into a browser tab.
 */
export const metadata: Metadata = {
  manifest: "/worker.webmanifest",
  appleWebApp: { capable: true, title: "KRISHOE Worker", statusBarStyle: "black-translucent" },
  icons: { apple: "/icons/worker-192.png" },
};

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  return children;
}
