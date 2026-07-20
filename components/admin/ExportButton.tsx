"use client";

import { useState } from "react";

type ExportButtonProps = {
  href: string;
  className?: string;
  children: React.ReactNode;
};

// Downloads a CSV reliably from anywhere — a desktop tab, a phone browser, or
// the installed app. The export links used to be plain navigations to the API
// route, which the installed app (a standalone PWA with no download chrome) and
// some phone browsers would open as a blank page or a wall of text instead of
// saving a file. This fetches the file, then hands the browser a real download
// with its filename, which every one of them honours.
export default function ExportButton({ href, className, children }: ExportButtonProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);

    try {
      const response = await fetch(href, { cache: "no-store" });

      if (!response.ok) {
        throw new Error(`Export failed (${response.status})`);
      }

      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const named = disposition.match(/filename="?([^"]+)"?/);
      const filename = named ? named[1] : "krishoe-export.csv";

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={busy}
      className={className}
      title={failed ? "Download did not start — tap to try again." : undefined}
    >
      {busy ? "Downloading…" : failed ? "Try again" : children}
    </button>
  );
}
