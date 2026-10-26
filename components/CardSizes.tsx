"use client";

import { useCommerce } from "@/components/commerce/CommerceProvider";
import { useLanguage } from "@/components/LanguageProvider";
import { sizeChoices } from "@/components/SizeSheet";
import type { Product } from "@/lib/products";

/** Chips that fit one line of a phone card; the rest are a "+2". */
const SHOWN = 5;

/**
 * The sizes on a card (owner, 2026-10-07): which sizes there are, without
 * opening the shoe. A size the shelf has none of is struck through — only for
 * a shoe kept size by size, the same rule as the size sheet, so a shoe kept as
 * one pile never shows a size as gone that is in the pile.
 *
 * The stock is read from the shop's live catalog, the one the size sheet and
 * the cart use, so a card from a cached page still strikes today's sizes.
 */
export default function CardSizes({ product }: { product: Pick<Product, "id" | "sizes" | "sizeStock"> }) {
  const { text } = useLanguage();
  const { products } = useCommerce();
  const live = products.find((item) => item.id === product.id) ?? product;
  const choices = sizeChoices({ sizes: live.sizes, sizeStock: live.sizeStock });
  if (choices.length === 0) return null;

  // Sizes still on the shelf first, so the five shown are ones that can be bought.
  const ordered = [...choices.filter((choice) => !choice.soldOut), ...choices.filter((choice) => choice.soldOut)];
  const shown = ordered.slice(0, SHOWN).sort((a, b) => Number(a.size) - Number(b.size));
  const more = ordered.length - shown.length;

  return (
    // Small enough that five sizes fit a phone card whole (owner's shop
    // sample, 2, 2026-10-26): at 13px the fifth was cut to "4(".
    <p className="mt-1 flex items-center gap-0.5 overflow-hidden whitespace-nowrap md:gap-1">
      {/* Read aloud as words: a label on a <p> is not allowed, and screen
          readers skip it (accessibility check, 2026-10-07). */}
      <span className="sr-only">
        {text(
          `Sizes: ${choices.filter((choice) => !choice.soldOut).map((choice) => choice.size).join(", ")}`,
          `साइज: ${choices.filter((choice) => !choice.soldOut).map((choice) => choice.size).join(", ")}`,
        )}
      </span>
      {shown.map((choice) => (
        <span
          key={choice.size}
          aria-hidden="true"
          className={`rounded-md border px-[3px] text-[11.5px] font-bold tabular-nums leading-[18px] md:px-1 md:text-[13px] md:leading-5 ${
            choice.soldOut
              ? "border-brand-green-line text-brand-muted line-through"
              : "border-brand-green/40 text-brand-green"
          }`}
        >
          {choice.size}
        </span>
      ))}
      {more > 0 ? (
        <span aria-hidden="true" className="text-[11.5px] font-bold text-brand-muted md:text-[13px]">
          +{more}
        </span>
      ) : null}
    </p>
  );
}
