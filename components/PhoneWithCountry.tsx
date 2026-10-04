"use client";

import { useState } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { joinPhone, NEPAL_CODE, PHONE_COUNTRIES, splitPhone } from "@/lib/phone-intl";

/** A style without its width classes, so the box's own width stands. */
export function withoutWidth(classes: string) {
  return classes
    .split(/\s+/)
    .filter((name) => name && !/^(?:[a-z]+:)*(?:min-|max-)?w-/.test(name))
    .join(" ");
}

/**
 * A phone box with its country beside it (owner, 2026-10-03). Nepal is chosen
 * to start with, so a Nepali number is typed exactly as before and kept as its
 * ten digits; any other country keeps its code with the number. Typing "+91…"
 * straight into the box picks India by itself.
 *
 * Works in a plain form (give it `name`: the joined number goes in a hidden
 * field of that name) or a controlled one (`value` and `onChange`).
 */
export default function PhoneWithCountry({
  name,
  defaultValue = "",
  value,
  onChange,
  required = false,
  placeholder,
  ariaLabel,
  inputClass = "",
  selectClass = "",
}: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (joined: string) => void;
  required?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  inputClass?: string;
  selectClass?: string;
}) {
  const { text } = useLanguage();
  const start = splitPhone(value ?? defaultValue);
  const [code, setCode] = useState(start.code);
  const [national, setNational] = useState(start.national);
  // A controlled parent may clear or replace the number (a new bill); follow it.
  const [seen, setSeen] = useState(value);
  if (value !== undefined && value !== seen) {
    setSeen(value);
    const next = splitPhone(value);
    if (joinPhone(code, national) !== value) {
      setCode(next.code);
      setNational(next.national);
    }
  }

  const joined = joinPhone(code, national);

  function typeNumber(next: string) {
    // "+91 98…" typed into the box: the country follows what was typed.
    if (/^\s*(\+|00)\d/.test(next)) {
      const split = splitPhone(next);
      if (split.code !== code) setCode(split.code);
    }
    setNational(next);
    onChange?.(joinPhone(/^\s*(\+|00)/.test(next) ? splitPhone(next).code : code, next));
  }

  function chooseCountry(next: string) {
    setCode(next);
    // A typed "+code" gives way to the box once the box is changed.
    const plain = national.replace(/^\s*(\+|00)\d+\s*/, "");
    setNational(plain);
    onChange?.(joinPhone(next, plain));
  }

  return (
    <span className="flex min-w-0 gap-2">
      <select
        value={code}
        onChange={(event) => chooseCountry(event.target.value)}
        aria-label={text("Country", "देश")}
        // The country box keeps its own width: a "w-full" in the shared input
        // style took the whole row on the bill page and left the number a
        // sliver (owner, 2026-10-04).
        className={`w-[7.75rem] flex-none ${withoutWidth(selectClass || inputClass)}`}
      >
        {PHONE_COUNTRIES.map((country) => (
          <option key={country.code} value={country.code}>
            {country.flag} +{country.code}
          </option>
        ))}
      </select>
      <input
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        value={national}
        onChange={(event) => typeNumber(event.target.value)}
        required={required}
        maxLength={24}
        placeholder={placeholder ?? (code === NEPAL_CODE ? "98XXXXXXXX" : text("Number", "नम्बर"))}
        aria-label={ariaLabel ?? text("Phone number", "फोन नम्बर")}
        className={`min-w-0 flex-1 ${inputClass}`}
      />
      {name ? <input type="hidden" name={name} value={joined} /> : null}
    </span>
  );
}
