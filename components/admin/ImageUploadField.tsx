"use client";

import Image from "next/image";
import { useRef, useState } from "react";

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
  const inputRef = useRef<HTMLInputElement>(null);

  const urls = multiple ? splitUrls(value) : value.trim() ? [value.trim()] : [];

  async function uploadFiles(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    setError("");
    setUploading(true);

    try {
      const uploaded: string[] = [];

      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/admin/upload", { method: "POST", body: formData });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `Upload failed (${response.status}).`);
        }

        const data = (await response.json()) as { url: string };
        uploaded.push(data.url);

        if (!multiple) {
          break;
        }
      }

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
          disabled={uploading}
          className="inline-flex h-9 items-center gap-2 rounded-full border border-black/10 px-3 text-sm font-semibold text-[#0B4D3B] transition hover:bg-[#F5F7F4] disabled:opacity-60"
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

      {error ? <p className="text-xs font-semibold text-[#B3261E]">{error}</p> : null}

      {urls.some(isPreviewable) ? (
        <div className="mt-1 flex flex-wrap gap-2">
          {urls.filter(isPreviewable).map((url) => (
            <span
              key={url}
              className="relative h-16 w-16 overflow-hidden rounded-lg border border-black/10 bg-[#F5F7F4]"
            >
              <Image src={url} alt="" fill sizes="64px" className="object-cover" />
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
