"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

type KnownInvoice = {
  id: string;
  invoiceNumber: string;
  barcodeValue: string;
  qrPayload: string;
};

type BarcodeDetectorResult = {
  rawValue: string;
  format?: string;
};

type BarcodeDetectorInstance = {
  detect(source: HTMLVideoElement): Promise<BarcodeDetectorResult[]>;
};

type BarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => BarcodeDetectorInstance;

type WindowWithBarcodeDetector = Window & {
  BarcodeDetector?: BarcodeDetectorConstructor;
};

export default function ScannerPanel({ knownInvoices }: { knownInvoices: KnownInvoice[] }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
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
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsScanning(false);
  }

  async function startScanner() {
    const detectorConstructor = (window as WindowWithBarcodeDetector).BarcodeDetector;

    if (!detectorConstructor) {
      setStatus("Scanner not supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      const video = videoRef.current;

      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      const detector = new detectorConstructor({
        formats: ["qr_code", "code_128", "ean_13", "ean_8", "upc_a", "upc_e"],
      });

      streamRef.current = stream;
      video.srcObject = stream;
      await video.play();
      setIsScanning(true);
      setStatus("Scanning");

      const scanFrame = async () => {
        try {
          const results = await detector.detect(video);
          const rawValue = results[0]?.rawValue?.trim();

          if (rawValue) {
            setScanValue(rawValue);
            setStatus(results[0]?.format ? `Detected ${results[0].format}` : "Detected");
            stopScanner();
            return;
          }
        } catch {
          setStatus("Scanner paused");
        }

        frameRef.current = requestAnimationFrame(scanFrame);
      };

      frameRef.current = requestAnimationFrame(scanFrame);
    } catch {
      setStatus("Camera permission unavailable");
      stopScanner();
    }
  }

  useEffect(() => stopScanner, []);

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[#10231D]">Scan invoice</h2>
          <p className="mt-1 text-sm text-gray-500">{status}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={startScanner}
            disabled={isScanning}
            className="rounded-full bg-[#0B4D3B] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            Start
          </button>
          <button
            type="button"
            onClick={stopScanner}
            className="rounded-full border border-gray-200 px-4 py-2 text-sm font-bold text-[#10231D]"
          >
            Stop
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-gray-100 bg-black">
        <video ref={videoRef} muted playsInline className="aspect-video w-full object-cover" />
      </div>

      <div className="mt-4 grid gap-3">
        <input
          value={scanValue}
          onChange={(event) => setScanValue(event.target.value)}
          className="h-10 rounded-md border border-gray-200 px-3 font-mono text-xs outline-none focus:border-[#0B4D3B]"
          placeholder="Scan result"
        />
        {matchedInvoice ? (
          <Link
            href={`/admin/pos/${matchedInvoice.id}`}
            className="inline-flex h-10 items-center justify-center rounded-full bg-[#10231D] px-4 text-sm font-bold text-white"
          >
            Open matched bill
          </Link>
        ) : scanValue ? (
          <p className="text-sm font-semibold text-[#7B3128]">No matching bill found.</p>
        ) : null}
      </div>
    </section>
  );
}
