import { designKey } from "@/lib/design-name";

/**
 * Where a shoe's pairs came from (owner, 2026-10-29): made in our factory
 * (a "Production In"), bought ready-made (a "Purchase In"), or both. Products
 * holds every shoe the shop sells, made or bought; this tells the two apart
 * from the stock's own history, so no one has to mark it by hand. An opening
 * count or an adjustment says neither.
 */
export type StockOrigin = { made: boolean; bought: boolean };

export function stockOrigins(movements: Array<{ design: string; type: string }>) {
  const origins = new Map<string, StockOrigin>();
  for (const movement of movements) {
    const made = movement.type === "Production In";
    const bought = movement.type === "Purchase In";
    if (!made && !bought) continue;
    const key = designKey(movement.design);
    if (!key) continue;
    const current = origins.get(key) ?? { made: false, bought: false };
    origins.set(key, { made: current.made || made, bought: current.bought || bought });
  }
  return origins;
}

/** The origin of one shoe by its name, or none when its history says neither. */
export function originOf(origins: Map<string, StockOrigin> | Record<string, StockOrigin>, name: string) {
  const key = designKey(name);
  return origins instanceof Map ? origins.get(key) : origins[key];
}
