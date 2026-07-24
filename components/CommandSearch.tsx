"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { categories } from "@/lib/products";
import { SearchIcon, XIcon } from "@/components/Icons";

// Command-palette style search: opens on Ctrl/⌘+K or "/", closes on Esc.
export default function CommandSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if ((event.key === "k" || event.key === "K") && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      } else if (event.key === "/" && !isTyping) {
        // "/" is a shortcut only when the user isn't already typing somewhere.
        event.preventDefault();
        setOpen(true);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    // Let other components (e.g. the mobile bottom tab-bar) open this palette.
    function openHandler() {
      setOpen(true);
    }

    window.addEventListener("krishoe:open-search", openHandler);
    return () => window.removeEventListener("krishoe:open-search", openHandler);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const focusTimer = setTimeout(() => inputRef.current?.focus(), 20);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  function closePalette() {
    setOpen(false);
    setQuery("");
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.trim();
    router.push(cleanQuery ? `/shop?query=${encodeURIComponent(cleanQuery)}` : "/shop");
    closePalette();
  }

  return (
    <>
      {/* Desktop: full search pill with keyboard hint. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search premium styles"
        className="hidden h-10 items-center gap-2 rounded-full border border-black/10 bg-[#F7F8F5] px-4 text-brand-muted-deep transition hover:border-brand-green/40 xl:flex"
      >
        <SearchIcon className="h-4 w-4" />
        <span className="text-sm">Search premium styles</span>
        <kbd className="ml-1 rounded border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-semibold text-brand-muted-deep">
          Ctrl K
        </kbd>
      </button>

      {/* The lg band only: below lg the bottom tab bar carries Search, and at xl
          the full pill above takes over — so the top bar never doubles up. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search premium styles"
        className="hidden h-10 w-10 place-items-center rounded-full border border-black/10 text-brand-green transition hover:border-brand-green hover:bg-brand-mist lg:grid xl:hidden"
      >
        <SearchIcon className="h-5 w-5" />
      </button>

      {open ? (
        <div className="fixed inset-0 z-[60]">
          <button
            type="button"
            aria-label="Close search"
            onClick={closePalette}
            className="absolute inset-0 bg-brand-green-ink/55 backdrop-blur-sm"
          />
          <div className="absolute left-1/2 top-4 flex max-h-[calc(100dvh-2rem)] w-[min(94vw,560px)] -translate-x-1/2 flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:top-24 sm:max-h-[80vh]">
            <form onSubmit={submitSearch} className="flex items-center gap-3 border-b border-black/10 px-4">
              <SearchIcon className="h-5 w-5 shrink-0 text-brand-muted-deep" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search premium styles..."
                enterKeyHint="search"
                className="h-14 w-full bg-transparent text-base outline-none placeholder:text-[#9AA29E]"
              />
              <button
                type="button"
                onClick={closePalette}
                aria-label="Close"
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-brand-muted-deep transition hover:bg-brand-mist"
              >
                <XIcon className="h-4 w-4" />
              </button>
            </form>

            <div className="overflow-y-auto p-3">
              <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#9AA29E]">
                Browse categories
              </p>
              <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                {categories.map((category) => (
                  <Link
                    key={category.slug}
                    href={`/shop/${category.slug}`}
                    onClick={closePalette}
                    className="flex items-center gap-3 rounded-xl p-2.5 transition hover:bg-brand-mist active:bg-[#EDF1EE]"
                  >
                    <Image
                      src={category.image}
                      alt={category.title}
                      width={44}
                      height={44}
                      className="h-11 w-11 shrink-0 rounded-lg object-cover"
                    />
                    <span className="text-sm font-medium text-brand-green-ink">{category.title}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
