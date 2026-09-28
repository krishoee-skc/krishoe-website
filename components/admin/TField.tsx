"use client";

import type { InputHTMLAttributes, OptionHTMLAttributes } from "react";
import { useLanguage } from "@/components/LanguageProvider";

/**
 * A box whose placeholder follows the reader's language, for server pages
 * (the way <T> does it for text): a placeholder is an attribute, and <T>
 * cannot sit inside one.
 */
export function TInput({ en, ne, ...props }: InputHTMLAttributes<HTMLInputElement> & { en: string; ne: string }) {
  const { text } = useLanguage();
  // Named by its own aria-label when the page gives one, else by its placeholder.
  return <input {...props} aria-label={props["aria-label"] ?? text(en, ne)} placeholder={text(en, ne)} />;
}

/** An <option> whose words follow the reader's language. */
export function TOption({ en, ne, ...props }: OptionHTMLAttributes<HTMLOptionElement> & { en: string; ne: string }) {
  const { text } = useLanguage();
  return <option {...props}>{text(en, ne)}</option>;
}
