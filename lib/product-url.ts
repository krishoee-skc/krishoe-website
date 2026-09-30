import type { Product } from "@/lib/products";

/**
 * A shoe's address in words (owner, 2026-10-01): /product/bantu-hill-kr-201
 * rather than /product/571e0e15-0263-4873-a146-f09bb3cab6f8. The name tells a
 * searcher and a shared link what the shoe is; the code on the end keeps it
 * unique and findable after a rename. The product's own name and id are not
 * touched — stock and bills are kept by name — only how its page is reached.
 */
function words(value: string) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

export function productSlug(product: Pick<Product, "id" | "name" | "sku">) {
  const tail = words(product.sku) || words(product.id);
  const name = words(product.name);
  return name && !name.endsWith(tail) ? `${name}-${tail}` : name || tail;
}

export function productPath(product: Pick<Product, "id" | "name" | "sku">, language: "en" | "ne" = "en") {
  return `${language === "ne" ? "/ne" : ""}/product/${productSlug(product)}`;
}

/**
 * The shoe an address names: its id (every link made before this), its
 * address in words, or — after a rename — an older address ending in the
 * same code.
 */
export function findProductByParam<T extends Pick<Product, "id" | "name" | "sku">>(items: T[], param: string) {
  const wanted = decodeURIComponent(String(param ?? "")).trim().toLowerCase();
  if (!wanted) return undefined;
  const byId = items.find((product) => product.id.toLowerCase() === wanted);
  if (byId) return byId;
  const bySlug = items.find((product) => productSlug(product) === wanted);
  if (bySlug) return bySlug;
  return items.find((product) => {
    const code = words(product.sku);
    return code !== "" && wanted.endsWith(`-${code}`);
  });
}
