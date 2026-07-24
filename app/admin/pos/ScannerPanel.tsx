"use client";

import type { IScannerControls } from "@zxing/browser";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type KnownInvoice = {
  id: string;
  invoiceNumber: string;
  barcodeValue: string;
  qrPayload: string;
};

export default function ScannerPanel({ knownInvoices }: { knownInvoices: KnownInvoice[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [scanValue, setScanValue] = useState("");

  const matchedInvoice = useMemo(() => {
    const value = scanValue.trim();

    if (!value) {
      return null;
    }

    return (
      knownInvoices.find(
        (invoice) =>
          invoice.invoiceNumber === value ||
          invoice.barcodeValue === value ||
          invoice.qrPayload === value ||
          invoice.qrPayload.includes(value),
      ) ?? null
    );
  }, [knownInvoices, scanValue]);

  function stopScanner() {
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;
    setIsScanning(false);
  }

  async function startScanner() {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setStatus("Camera scanning needs HTTPS. You can upload a photo or type the invoice number.");
      return;
    }

    try {
      stopScanner();
      const video = videoRef.current;

      if (!video) {
        return;
      }

      setStatus("Starting camera");
      setIsScanning(true);
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      let detectedDuringStart = false;
      const controls = await reader.decodeFromConstraints(
        {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        video,
        (result, _error, activeControls) => {
          if (!result) {
            return;
          }

          const rawValue = result.getText().trim();

          if (!rawValue) {
            return;
          }

          detectedDuringStart = true;
          setScanValue(rawValue);
          setStatus(`Detected ${result.getBarcodeFormat().toString()}`);
          activeControls.stop();
          scannerControlsRef.current = null;
          setIsScanning(false);
        },
      );

      if (detectedDuringStart) {
        controls.stop();
      } else {
        scannerControlsRef.current = controls;
        setStatus("Scanning — point the camera at a QR code or barcode");
      }
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : "";
      setStatus(
        errorName === "NotAllowedError"
          ? "Camera permission denied. Allow camera access or upload a photo."
          : errorName === "NotFoundError"
            ? "No camera was found. Upload a photo or type the invoice number."
            : "Camera could not start. Upload a photo or type the invoice number.",
      );
      stopScanner();
    }
  }

  async function scanImage(file: File | undefined) {
    if (!file) {
      return;
    }

    stopScanner();
    setStatus("Reading image");
    const imageUrl = URL.createObjectURL(file);

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const result = await reader.decodeFromImageUrl(imageUrl);
      setScanValue(result.getText().trim());
      setStatus(`Detected ${result.getBarcodeFormat().toString()} from image`);
    } catch {
      setStatus("No QR code or barcode found in that image. Try a clearer photo.");
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  useEffect(() => stopScanner, []);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-black text-brand-green-ink">Scan invoice</h2>
          <p className="mt-1 break-words text-sm leading-5 text-gray-500" aria-live="polite">{status}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={startScanner}
            disabled={isScanning}
            className="inline-flex h-11 items-center justify-center rounded-full bg-brand-green px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Start
          </button>
          <button
            type="button"
            onClick={stopScanner}
            className="inline-flex h-11 items-center justify-center rounded-full border border-gray-200 px-5 text-sm font-bold text-brand-green-ink"
          >
            Stop
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-100 bg-black">
        <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
      </div>

      <div className="mt-4 grid gap-3">
        <label className="inline-flex h-11 cursor-pointer items-center justify-center rounded-full border border-brand-green px-4 text-sm font-bold text-brand-green">
          Scan from photo
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(event) => {
              void scanImage(event.target.files?.[0]);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <input
          value={scanValue}
          onChange={(event) => setScanValue(event.target.value)}
          className="h-12 rounded-md border border-gray-200 px-3 font-mono outline-none focus:border-brand-green"
          inputMode="text"
          aria-label="Scanned invoice number"
          placeholder="Scan result or invoice number"
        />
        {matchedInvoice ? (
          <Link
            href={`/admin/pos/${matchedInvoice.id}`}
            className="inline-flex h-12 items-center justify-center rounded-full bg-brand-green-ink px-4 text-sm font-bold text-white"
          >
            Open matched bill
          </Link>
        ) : scanValue ? (
          <p className="text-sm font-semibold text-brand-clay">No matching bill found.</p>
        ) : null}
      </div>
    </section>
  );
}
