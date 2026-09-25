"use client";

import { useRef } from "react";
import { useLanguage } from "@/components/LanguageProvider";
import { generateTemporaryPassword } from "@/lib/temporary-password";

/**
 * The temporary-password box with a 🎲 button that fills it with a strong one
 * ("Chappal-Hill-4827") the Owner can read out. Typing one still works; the
 * server refuses anything short, obvious, or made of the person's name.
 */
export default function TemporaryPasswordField({
  inputClass,
  buttonClass,
  placeholder,
  required = false,
}: {
  inputClass: string;
  buttonClass: string;
  placeholder: string;
  required?: boolean;
}) {
  const { text } = useLanguage();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <span className="flex min-w-0 flex-1 gap-2">
      <input
        ref={inputRef}
        aria-label={placeholder}
        name="temporaryPassword"
        type="text"
        minLength={12}
        required={required}
        autoComplete="off"
        spellCheck={false}
        placeholder={placeholder}
        className={inputClass}
      />
      <button
        type="button"
        className={`${buttonClass} shrink-0`}
        title={text("Make a strong password", "बलियो password बनाउनुहोस्")}
        onClick={() => {
          const input = inputRef.current;
          if (!input) return;
          input.value = generateTemporaryPassword();
          input.focus();
          input.select();
        }}
      >
        🎲 <span className="sr-only sm:not-sr-only">{text("Make one", "बनाउनुहोस्")}</span>
      </button>
    </span>
  );
}
