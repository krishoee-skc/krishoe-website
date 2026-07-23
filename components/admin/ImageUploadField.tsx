"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type UploadStatus = "checking" | "blob" | "database" | "local" | "none";

type ImageUploadFieldProps = {
  name: string;
  label: string;
  initialValue?: string;
  // Gallery mode: the field holds a comma-separated list and uploads append.
  multiple?: boolean;
  placeholder?: string;
};

function splitUrls(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

// next/image throws on a src that is neither an absolute URL nor a root-relative
// path, so only preview values that are safe to render (skips half-typed URLs).
function isPreviewable(url: string) {
  return url.startsWith("/") || url.startsWith("https://") || url.startsWith("http://");
}

export default function ImageUploadField({
  name,
  label,
  initialValue = "",
  multiple = false,
  placeholder,
}: ImageUploadFieldProps) {
  const [value, setValue] = useState(initialValue);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  // Set when a photo was saved to the local dev folder, which the live shop
  // cannot load. Better to say so than to ship a broken image.
  const [localOnly, setLocalOnly] = useState(false);
  // Where uploads would land, checked when the form opens so the owner knows
  // before choosing a photo — not after a failed upload.
  const [status, setStatus] = useState<UploadStatus>("checking");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let active = true;

    fetch("/api/admin/upload", { method: "GET" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { storage?: UploadStatus } | null) => {
        if (active && data?.storage) {
          setStatus(data.storage);
        }
      })
      .catch(() => {
        // Leave it as "checking"; the upload attempt still reports the real
        // outcome, so a failed readiness probe does not block anything.
      });

    return () => {
      active = false;
    };
  }, []);

  const urls = multiple ? splitUrls(value) : value.trim() ? [value.trim()] : [];

  // The ✕ on a preview. Editing a comma-separated list by hand to drop an old
  // placeholder is not something the owner should have to do.
  function removeUrl(url: string) {
    setValue((previous) => {
      if (!multiple) {
        return "";
      }

      return splitUrls(previous)
        .filter((item) => item !== url)
        .join(", ");
    });
  }

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    setError("");
    setUploading(true);

    try {
      const uploaded: string[] = [];
      let anyLocal = false;

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/admin/upload", { method: "POST", body: formData });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `Upload failed (${response.status}).`);
        }

        const data = (await response.json()) as { url: string; local?: boolean };
        uploaded.push(data.url);
        anyLocal = anyLocal || Boolean(data.local);

        if (!multiple) {
          break;
        }
      }

      setLocalOnly(anyLocal);

      setValue((previous) =>
        multiple ? [...splitUrls(previous), ...uploaded].join(", ") : uploaded[0] ?? previous,
      );
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>

      <input
        name={name}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="form-input"
        placeholder={placeholder}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading || status === "none"}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-black/10 px-3 text-sm font-semibold text-brand-green transition hover:bg-brand-mist disabled:opacity-60"
        >
          {uploading ? "Uploading…" : multiple ? "Upload photos" : "Upload photo"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple={multiple}
          hidden
          onChange={(event) => uploadFiles(event.target.files)}
        />
        <span className="text-xs text-gray-500">or paste a URL above</span>
      </div>

      {status === "blob" || status === "database" ? (
        <p className="text-xs font-medium text-brand-green">
          Photos upload to the shop. Up to 4.5 MB each — JPEG, PNG, or WebP.
        </p>
      ) : null}

      {status === "none" ? (
        <p className="text-xs font-semibold text-brand-clay">
          Upload is not set up. Paste a public image URL above, or connect a Vercel Blob store and
          redeploy to turn the button on.
        </p>
      ) : null}

      {error ? <p className="text-xs font-semibold text-brand-danger">{error}</p> : null}

      {localOnly ? (
        <p className="text-xs font-semibold text-brand-clay">
          Saved on this computer for testing. It will not show on the live shop — for that, set up
          a Vercel Blob store, or paste a public image URL above.
        </p>
      ) : null}

      {urls.some(isPreviewable) ? (
        <div className="mt-1 flex flex-wrap gap-2">
          {urls.filter(isPreviewable).map((url) => (
            <span
              key={url}
              className="relative h-16 w-16 overflow-hidden rounded-lg border border-black/10 bg-brand-mist"
            >
              <Image src={url} alt="" fill sizes="64px" className="object-cover" />
              <button
                type="button"
                onClick={() => removeUrl(url)}
                aria-label="Remove this photo"
                title="Remove this photo"
                className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-[10px] font-black text-white transition hover:bg-brand-danger"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
