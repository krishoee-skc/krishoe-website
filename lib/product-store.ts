import { promises as fs } from "fs";
import { writeFileAtomic } from "@/lib/atomic-json";
import path from "path";
import { runWithDataBackend } from "@/lib/data-backend";
import { getOperationsData, type FinishedStock } from "@/lib/operations";
import { queryPostgres } from "@/lib/postgres/client";
import {
  categories,
  formatPrice,
  getProductByIdFromList,
  getRelatedProductsFromList,
  products as seedProducts,
  searchProductList,
  type Review,
  type Product,
} from "@/lib/products";

const dataDir = path.join(process.cwd(), "data");
const productsFile = path.join(dataDir, "products.json");

export type ProductStockSyncSignal = "Synced" | "Already synced" | "No operations stock";

export type ProductStockSyncRow = {
  productId: string;
  sku: string;
  productName: string;
  matchedOperationsDesigns: string;
  previousStock: number;
  nextStock: number;
  delta: number;
  signal: ProductStockSyncSignal;
};

export type ProductStockSyncResult = {
  rows: ProductStockSyncRow[];
  matchedProducts: number;
  updatedProducts: number;
  unmatchedProducts: number;
  totalDelta: number;
};

type ProductStockSyncBuildResult = ProductStockSyncResult & {
  products: Product[];
};

type ProductRow = {
  id: string;
  sku: string | null;
  name: string;
  category: string;
  category_slug: string;
  price: string;
  price_value: number | string;
  wholesale_price_value: number | string | null;
  min_wholesale_qty: number | string | null;
  image: string;
  gallery: string[] | null;
  badge: string | null;
  rating: string;
  description: string;
  long_description: string;
  material: string;
  fit: string;
  colors: string[] | null;
  sizes: string[] | null;
  stock: number | string;
  highlights: string[] | null;
  care: string[] | null;
  reviews: unknown;
  status: string;
  featured: boolean;
  best_seller: boolean;
  new_arrival: boolean;
};

const reviewStatuses: Review["status"][] = ["pending", "approved", "rejected"];

function cleanReview(review: Review): Review {
  return {
    id: review.id.trim(),
    name: review.name.trim() || "Customer",
    rating: Math.min(5, Math.max(1, Math.round(Number(review.rating) || 5))),
    comment: review.comment.trim(),
    createdAt: review.createdAt || new Date().toISOString(),
    status: reviewStatuses.includes(review.status) ? review.status : "pending",
  };
}

function cleanProduct(product: Product): Product {
  const category = categories.find((item) => item.slug === product.categorySlug) ?? categories[0];
  const priceValue = Math.max(0, Math.round(Number(product.priceValue) || 0));
  const wholesalePriceValue = Math.max(0, Math.round(Number(product.wholesalePriceValue) || 0));
  const minWholesaleQty = Math.max(1, Math.round(Number(product.minWholesaleQty) || 1));
  const stock = Math.max(0, Math.round(Number(product.stock) || 0));
  const image = product.image.trim() || category.image;
  const colors = product.colors.filter(Boolean);
  const sizes = product.sizes.filter(Boolean);

  return {
    ...product,
    id: product.id.trim(),
    sku: product.sku.trim(),
    name: product.name.trim(),
    category: category.title,
    categorySlug: category.slug,
    price: formatPrice(priceValue),
    priceValue,
    wholesalePriceValue,
    minWholesaleQty,
    image,
    gallery: product.gallery.length > 0 ? product.gallery.filter(Boolean) : [image],
    badge: product.badge?.trim() || undefined,
    rating: product.rating.trim() || "4.8",
    description: product.description.trim(),
    longDescription: product.longDescription.trim(),
    material: product.material.trim() || "Premium synthetic finish",
    fit: product.fit.trim() || "Regular fit",
    colors: colors.length > 0 ? colors : ["Black"],
    sizes: sizes.length > 0 ? sizes : ["36", "37", "38", "39", "40"],
    stock,
    highlights: product.highlights.length > 0 ? product.highlights.filter(Boolean) : ["Comfort-focused build"],
    care: product.care.length > 0 ? product.care.filter(Boolean) : ["Wipe clean with a soft cloth"],
    reviews: Array.isArray(product.reviews) ? product.reviews.map(cleanReview) : [],
    status: product.status === "Draft" ? "Draft" : "Active",
    featured: Boolean(product.featured),
    bestSeller: Boolean(product.bestSeller),
    newArrival: Boolean(product.newArrival),
  };
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function productStockKey(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function productStockAliasKeys(product: Product) {
  return [...new Set([product.name, product.sku, product.id].map(productStockKey).filter(Boolean))];
}

function cleanStockValue(value: number) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function buildFinishedStockGroups(finishedStock: FinishedStock[]) {
  const groups = new Map<string, { key: string; design: string; stockPairs: number }>();

  for (const stock of finishedStock) {
    const key = productStockKey(stock.design);
    const group = groups.get(key) ?? {
      key,
      design: stock.design.trim(),
      stockPairs: 0,
    };

    group.stockPairs += cleanStockValue(stock.stockPairs);
    groups.set(key, group);
  }

  return groups;
}

function publicProductStockSyncResult(result: ProductStockSyncBuildResult): ProductStockSyncResult {
  return {
    rows: result.rows,
    matchedProducts: result.matchedProducts,
    updatedProducts: result.updatedProducts,
    unmatchedProducts: result.unmatchedProducts,
    totalDelta: result.totalDelta,
  };
}

function buildProductStockSync(
  products: Product[],
  finishedStock: FinishedStock[],
): ProductStockSyncBuildResult {
  const finishedStockGroups = buildFinishedStockGroups(finishedStock);
  const rows: ProductStockSyncRow[] = [];
  let matchedProducts = 0;
  let updatedProducts = 0;
  let unmatchedProducts = 0;
  let totalDelta = 0;

  const nextProducts = products.map((product) => {
    const matchedGroups = productStockAliasKeys(product)
      .map((key) => finishedStockGroups.get(key))
      .filter((group): group is NonNullable<typeof group> => Boolean(group));
    const uniqueGroups = [...new Map(matchedGroups.map((group) => [group.key, group])).values()];

    if (uniqueGroups.length === 0) {
      unmatchedProducts += 1;
      rows.push({
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        matchedOperationsDesigns: "",
        previousStock: product.stock,
        nextStock: product.stock,
        delta: 0,
        signal: "No operations stock",
      });

      return product;
    }

    const nextStock = cleanStockValue(
      uniqueGroups.reduce((total, group) => total + group.stockPairs, 0),
    );
    const delta = nextStock - product.stock;
    matchedProducts += 1;
    totalDelta += Math.abs(delta);

    if (delta !== 0) {
      updatedProducts += 1;
    }

    rows.push({
      productId: product.id,
      sku: product.sku,
      productName: product.name,
      matchedOperationsDesigns: uniqueGroups.map((group) => group.design).join(" | "),
      previousStock: product.stock,
      nextStock,
      delta,
      signal: delta === 0 ? "Already synced" : "Synced",
    });

    return delta === 0 ? product : { ...product, stock: nextStock };
  });

  return {
    products: nextProducts,
    rows,
    matchedProducts,
    updatedProducts,
    unmatchedProducts,
    totalDelta,
  };
}

function reviewsArray(value: unknown): Review[] {
  return Array.isArray(value) ? (value as Review[]).map(cleanReview) : [];
}

function productFromRow(row: ProductRow): Product {
  return cleanProduct({
    id: row.id,
    sku: row.sku ?? row.id.toUpperCase(),
    name: row.name,
    category: row.category,
    categorySlug: row.category_slug,
    price: row.price,
    priceValue: Math.max(0, Math.round(Number(row.price_value) || 0)),
    wholesalePriceValue: Math.max(0, Math.round(Number(row.wholesale_price_value) || 0)),
    minWholesaleQty: Math.max(1, Math.round(Number(row.min_wholesale_qty) || 1)),
    image: row.image,
    gallery: stringArray(row.gallery),
    badge: row.badge ?? undefined,
    rating: row.rating,
    description: row.description,
    longDescription: row.long_description,
    material: row.material,
    fit: row.fit,
    colors: stringArray(row.colors),
    sizes: stringArray(row.sizes),
    stock: Math.max(0, Math.round(Number(row.stock) || 0)),
    highlights: stringArray(row.highlights),
    care: stringArray(row.care),
    reviews: reviewsArray(row.reviews),
    status: row.status === "Draft" ? "Draft" : "Active",
    featured: row.featured,
    bestSeller: row.best_seller,
    newArrival: row.new_arrival,
  });
}

async function readStoredProducts() {
  try {
    const content = await fs.readFile(productsFile, "utf8");
    const parsed = JSON.parse(content) as Product[];

    if (!Array.isArray(parsed)) {
      return null;
    }

    return parsed.map(cleanProduct).filter((product) => product.id && product.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function getProductsFromLocalJson(options: { includeDrafts?: boolean } = {}) {
  const storedProducts = await readStoredProducts();
  const allProducts = (storedProducts ?? seedProducts).map(cleanProduct);

  if (options.includeDrafts) {
    return allProducts;
  }

  return allProducts.filter((product) => product.status === "Active");
}

async function getProductsFromPostgres(options: { includeDrafts?: boolean } = {}) {
  const rows = await queryPostgres<ProductRow>(
    "products",
    `
      SELECT
        id,
        sku,
        name,
        category,
        category_slug,
        price,
        price_value,
        image,
        gallery,
        badge,
        rating,
        description,
        long_description,
        material,
        fit,
        colors,
        sizes,
        stock,
        highlights,
        care,
        reviews,
        status,
        featured,
        best_seller,
        new_arrival,
        wholesale_price_value,
        min_wholesale_qty
      FROM products
      ${options.includeDrafts ? "" : "WHERE status = 'Active'"}
      ORDER BY featured DESC, best_seller DESC, new_arrival DESC, name ASC
    `,
  );

  return rows.map(productFromRow);
}

async function writeProducts(products: Product[]) {
  await writeFileAtomic(productsFile, `${JSON.stringify(products.map(cleanProduct), null, 2)}\n`);
}

async function syncProductCatalogStockWithFinishedStockLocalJson(finishedStock: FinishedStock[]) {
  const products = await getProductsFromLocalJson({ includeDrafts: true });
  const result = buildProductStockSync(products, finishedStock);

  if (result.updatedProducts > 0) {
    await writeProducts(result.products);
  }

  return publicProductStockSyncResult(result);
}

async function syncProductCatalogStockWithFinishedStockPostgres(finishedStock: FinishedStock[]) {
  const products = await getProductsFromPostgres({ includeDrafts: true });
  const result = buildProductStockSync(products, finishedStock);

  for (const row of result.rows) {
    if (row.signal !== "Synced") {
      continue;
    }

    await queryPostgres<{ id: string }>(
      "products",
      "UPDATE products SET stock = $2, updated_at = now() WHERE id = $1 RETURNING id",
      [row.productId, row.nextStock],
    );
  }

  return publicProductStockSyncResult(result);
}

export async function getProducts(options: { includeDrafts?: boolean } = {}) {
  return runWithDataBackend({
    storeName: "products",
    localJson: () => getProductsFromLocalJson(options),
    postgres: () => getProductsFromPostgres(options),
  });
}

export async function syncProductCatalogStockWithFinishedStock() {
  const operations = await getOperationsData();

  return runWithDataBackend({
    storeName: "products",
    localJson: () => syncProductCatalogStockWithFinishedStockLocalJson(operations.finishedStock),
    postgres: () => syncProductCatalogStockWithFinishedStockPostgres(operations.finishedStock),
  });
}

export async function getProductById(id: string, options: { includeDrafts?: boolean } = {}) {
  const products = await getProducts(options);
  return getProductByIdFromList(products, id);
}

export async function getRelatedProducts(product: Product) {
  const products = await getProducts();
  return getRelatedProductsFromList(products, product);
}

export async function searchProducts(query: string) {
  const products = await getProducts();
  return searchProductList(products, query);
}

async function upsertProductLocalJson(product: Product) {
  const products = await getProductsFromLocalJson({ includeDrafts: true });
  const cleanedProduct = cleanProduct(product);
  const existingIndex = products.findIndex((item) => item.id === cleanedProduct.id);

  if (existingIndex >= 0) {
    products[existingIndex] = {
      ...cleanedProduct,
      reviews: cleanedProduct.reviews.length > 0 ? cleanedProduct.reviews : products[existingIndex].reviews,
    };
  } else {
    products.unshift(cleanedProduct);
  }

  await writeProducts(products);
  return cleanedProduct;
}

async function upsertProductPostgres(product: Product) {
  const cleanedProduct = cleanProduct(product);
  const rows = await queryPostgres<ProductRow>(
    "products",
    `
      INSERT INTO products (
        id,
        sku,
        name,
        category,
        category_slug,
        price,
        price_value,
        image,
        gallery,
        badge,
        rating,
        description,
        long_description,
        material,
        fit,
        colors,
        sizes,
        stock,
        highlights,
        care,
        reviews,
        status,
        featured,
        best_seller,
        new_arrival,
        wholesale_price_value,
        min_wholesale_qty,
        updated_at
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
        $21::jsonb, $22, $23, $24, $25, $26, $27, now()
      )
      ON CONFLICT (id) DO UPDATE SET
        sku = EXCLUDED.sku,
        name = EXCLUDED.name,
        category = EXCLUDED.category,
        category_slug = EXCLUDED.category_slug,
        price = EXCLUDED.price,
        price_value = EXCLUDED.price_value,
        image = EXCLUDED.image,
        gallery = EXCLUDED.gallery,
        badge = EXCLUDED.badge,
        rating = EXCLUDED.rating,
        description = EXCLUDED.description,
        long_description = EXCLUDED.long_description,
        material = EXCLUDED.material,
        fit = EXCLUDED.fit,
        colors = EXCLUDED.colors,
        sizes = EXCLUDED.sizes,
        stock = EXCLUDED.stock,
        highlights = EXCLUDED.highlights,
        care = EXCLUDED.care,
        reviews = CASE
          WHEN jsonb_array_length(EXCLUDED.reviews) > 0 THEN EXCLUDED.reviews
          ELSE products.reviews
        END,
        status = EXCLUDED.status,
        featured = EXCLUDED.featured,
        best_seller = EXCLUDED.best_seller,
        new_arrival = EXCLUDED.new_arrival,
        wholesale_price_value = EXCLUDED.wholesale_price_value,
        min_wholesale_qty = EXCLUDED.min_wholesale_qty,
        updated_at = now()
      RETURNING
        id,
        sku,
        name,
        category,
        category_slug,
        price,
        price_value,
        image,
        gallery,
        badge,
        rating,
        description,
        long_description,
        material,
        fit,
        colors,
        sizes,
        stock,
        highlights,
        care,
        reviews,
        status,
        featured,
        best_seller,
        new_arrival,
        wholesale_price_value,
        min_wholesale_qty
    `,
    [
      cleanedProduct.id,
      cleanedProduct.sku,
      cleanedProduct.name,
      cleanedProduct.category,
      cleanedProduct.categorySlug,
      cleanedProduct.price,
      cleanedProduct.priceValue,
      cleanedProduct.image,
      cleanedProduct.gallery,
      cleanedProduct.badge ?? null,
      cleanedProduct.rating,
      cleanedProduct.description,
      cleanedProduct.longDescription,
      cleanedProduct.material,
      cleanedProduct.fit,
      cleanedProduct.colors,
      cleanedProduct.sizes,
      cleanedProduct.stock,
      cleanedProduct.highlights,
      cleanedProduct.care,
      JSON.stringify(cleanedProduct.reviews),
      cleanedProduct.status,
      cleanedProduct.featured,
      cleanedProduct.bestSeller,
      cleanedProduct.newArrival,
      cleanedProduct.wholesalePriceValue,
      cleanedProduct.minWholesaleQty,
    ],
  );

  return productFromRow(rows[0]);
}

export async function upsertProduct(product: Product) {
  return runWithDataBackend({
    storeName: "products",
    localJson: () => upsertProductLocalJson(product),
    postgres: () => upsertProductPostgres(product),
  });
}

async function removeProductLocalJson(id: string) {
  const products = await getProductsFromLocalJson({ includeDrafts: true });
  const filteredProducts = products.filter((product) => product.id !== id);

  if (filteredProducts.length === products.length) {
    throw new Error("Product not found.");
  }

  await writeProducts(filteredProducts);
}

async function removeProductPostgres(id: string) {
  const rows = await queryPostgres<{ id: string }>(
    "products",
    "DELETE FROM products WHERE id = $1 RETURNING id",
    [id],
  );

  if (rows.length === 0) {
    throw new Error("Product not found.");
  }
}

export async function removeProduct(id: string) {
  return runWithDataBackend({
    storeName: "products",
    localJson: () => removeProductLocalJson(id),
    postgres: () => removeProductPostgres(id),
  });
}

async function addProductReviewLocalJson(productId: string, review: Omit<Review, "id" | "createdAt" | "status">) {
  const products = await getProductsFromLocalJson({ includeDrafts: true });
  const productIndex = products.findIndex((product) => product.id === productId);

  if (productIndex === -1) {
    throw new Error("Product not found.");
  }

  const record: Review = {
    ...review,
    id: `KRS-REV-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: "pending",
  };

  products[productIndex] = {
    ...products[productIndex],
    reviews: [record, ...products[productIndex].reviews],
  };

  await writeProducts(products);
  return record;
}

async function addProductReviewPostgres(productId: string, review: Omit<Review, "id" | "createdAt" | "status">) {
  const product = await getProductById(productId, { includeDrafts: true });

  if (!product) {
    throw new Error("Product not found.");
  }

  const record: Review = {
    ...review,
    id: `KRS-REV-${Date.now().toString(36).toUpperCase()}`,
    createdAt: new Date().toISOString(),
    status: "pending",
  };
  const nextReviews = [record, ...product.reviews];

  await queryPostgres<{ id: string }>(
    "products",
    "UPDATE products SET reviews = $2::jsonb, updated_at = now() WHERE id = $1 RETURNING id",
    [productId, JSON.stringify(nextReviews)],
  );

  return record;
}

export async function addProductReview(productId: string, review: Omit<Review, "id" | "createdAt" | "status">) {
  return runWithDataBackend({
    storeName: "products",
    localJson: () => addProductReviewLocalJson(productId, review),
    postgres: () => addProductReviewPostgres(productId, review),
  });
}

async function updateProductReviewStatusLocalJson(
  productId: string,
  reviewId: string,
  status: Review["status"],
) {
  const products = await getProductsFromLocalJson({ includeDrafts: true });
  const productIndex = products.findIndex((product) => product.id === productId);

  if (productIndex === -1) {
    throw new Error("Product not found.");
  }

  const reviewIndex = products[productIndex].reviews.findIndex((review) => review.id === reviewId);

  if (reviewIndex === -1) {
    throw new Error("Review not found.");
  }

  const review = cleanReview({ ...products[productIndex].reviews[reviewIndex], status });
  products[productIndex] = {
    ...products[productIndex],
    reviews: products[productIndex].reviews.map((item) => (item.id === reviewId ? review : item)),
  };

  await writeProducts(products);
  return { product: products[productIndex], review };
}

async function updateProductReviewStatusPostgres(
  productId: string,
  reviewId: string,
  status: Review["status"],
) {
  const product = await getProductById(productId, { includeDrafts: true });

  if (!product) {
    throw new Error("Product not found.");
  }

  const review = product.reviews.find((item) => item.id === reviewId);

  if (!review) {
    throw new Error("Review not found.");
  }

  const nextReview = cleanReview({ ...review, status });
  const nextReviews = product.reviews.map((item) => (item.id === reviewId ? nextReview : item));

  await queryPostgres<{ id: string }>(
    "products",
    "UPDATE products SET reviews = $2::jsonb, updated_at = now() WHERE id = $1 RETURNING id",
    [productId, JSON.stringify(nextReviews)],
  );

  return { product: { ...product, reviews: nextReviews }, review: nextReview };
}

export async function updateProductReviewStatus(
  productId: string,
  reviewId: string,
  status: Review["status"],
) {
  return runWithDataBackend({
    storeName: "products",
    localJson: () => updateProductReviewStatusLocalJson(productId, reviewId, status),
    postgres: () => updateProductReviewStatusPostgres(productId, reviewId, status),
  });
}

async function deleteProductReviewLocalJson(productId: string, reviewId: string) {
  const products = await getProductsFromLocalJson({ includeDrafts: true });
  const productIndex = products.findIndex((product) => product.id === productId);

  if (productIndex === -1) {
    throw new Error("Product not found.");
  }

  const review = products[productIndex].reviews.find((item) => item.id === reviewId);

  if (!review) {
    throw new Error("Review not found.");
  }

  products[productIndex] = {
    ...products[productIndex],
    reviews: products[productIndex].reviews.filter((item) => item.id !== reviewId),
  };

  await writeProducts(products);
  return { product: products[productIndex], review: cleanReview(review) };
}

async function deleteProductReviewPostgres(productId: string, reviewId: string) {
  const product = await getProductById(productId, { includeDrafts: true });

  if (!product) {
    throw new Error("Product not found.");
  }

  const review = product.reviews.find((item) => item.id === reviewId);

  if (!review) {
    throw new Error("Review not found.");
  }

  const nextReviews = product.reviews.filter((item) => item.id !== reviewId);

  await queryPostgres<{ id: string }>(
    "products",
    "UPDATE products SET reviews = $2::jsonb, updated_at = now() WHERE id = $1 RETURNING id",
    [productId, JSON.stringify(nextReviews)],
  );

  return { product: { ...product, reviews: nextReviews }, review: cleanReview(review) };
}

export async function deleteProductReview(productId: string, reviewId: string) {
  return runWithDataBackend({
    storeName: "products",
    localJson: () => deleteProductReviewLocalJson(productId, reviewId),
    postgres: () => deleteProductReviewPostgres(productId, reviewId),
  });
}
