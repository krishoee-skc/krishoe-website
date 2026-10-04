/**
 * Colour and size, read at a glance on the ledger (owner, 2026-10-04: "the
 * pairs, rate and colour should show clearly").
 */

/** A swatch for the colours the factory writes, or null for one it does not know. */
const SWATCHES: Record<string, string> = {
  red: "#C62828",
  maroon: "#7B1E1E",
  black: "#1F1F1F",
  white: "#F7F7F2",
  cream: "#EFE3C8",
  beige: "#E2CFA8",
  brown: "#6D4C41",
  tan: "#B98A57",
  skin: "#E0AC69",
  blue: "#1565C0",
  navy: "#1A2A5E",
  sky: "#64B5F6",
  green: "#2E7D32",
  olive: "#6B7A2A",
  grey: "#8E8E8E",
  gray: "#8E8E8E",
  silver: "#BDBDBD",
  pink: "#E05A8A",
  purple: "#6A1B9A",
  yellow: "#F2B705",
  golden: "#C9A227",
  gold: "#C9A227",
  orange: "#E8710A",
};

export function colourSwatch(name: string | null | undefined): string | null {
  const words = String(name ?? "").toLowerCase().split(/[^a-z]+/).filter(Boolean);
  // "Dark Red", "Red/Black": the first word the shop knows decides.
  for (const word of words) if (SWATCHES[word]) return SWATCHES[word];
  return null;
}

/** "36, 37, 38, 39, 40, 41" → "36–41"; anything not a plain run stays as written. */
export function compactSizes(size: string | null | undefined): string {
  const written = String(size ?? "").trim();
  const parts = written.split(/[,/\s]+/).filter(Boolean);
  if (parts.length < 3 || !parts.every((part) => /^\d{1,2}$/.test(part))) return written;
  const numbers = parts.map(Number);
  const isRun = numbers.every((value, index) => index === 0 || value === numbers[index - 1] + 1);
  return isRun ? `${numbers[0]}–${numbers[numbers.length - 1]}` : written;
}
