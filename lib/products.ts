export type Review = {
  id: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
  status: "pending" | "approved" | "rejected";
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  categorySlug: string;
  price: string;
  priceValue: number;
  // Wholesale (B2B) pricing. wholesalePriceValue is in paisa; 0 means "no
  // wholesale rate set" (retail price is used). minWholesaleQty is the minimum
  // order quantity enforced for wholesale-channel POS sales.
  wholesalePriceValue: number;
  minWholesaleQty: number;
  image: string;
  gallery: string[];
  badge?: string;
  rating: string;
  description: string;
  longDescription: string;
  material: string;
  fit: string;
  colors: string[];
  sizes: string[];
  stock: number;
  highlights: string[];
  care: string[];
  reviews: Review[];
  status: "Active" | "Draft";
  featured: boolean;
  bestSeller: boolean;
  newArrival: boolean;
};

export type Category = {
  title: string;
  slug: string;
  image: string;
  description: string;
};

export function formatPrice(value: number) {
  return `Rs. ${(value / 100).toLocaleString("en-IN")}`;
}

// Display label for a product's wholesale price, or null when none is set.
export function wholesalePriceLabel(product: Product) {
  return product.wholesalePriceValue > 0 ? formatPrice(product.wholesalePriceValue) : null;
}

export const categories: Category[] = [
  {
    title: "Ladies Sandals",
    slug: "ladies-sandals",
    image: "/images/products/ladies-sandals.jpg",
    description: "Elegant everyday pairs with soft support.",
  },
  {
    title: "Ladies Slippers",
    slug: "ladies-slippers",
    image: "/images/products/ladies-slippers.jpg",
    description: "Lightweight comfort for daily movement.",
  },
  {
    title: "Casual Shoes",
    slug: "casual-shoes",
    image: "/images/products/casual-shoes.jpg",
    description: "Clean silhouettes for work and weekends.",
  },
  {
    title: "Party Heels",
    slug: "party-heels",
    image: "/images/products/party-heels.jpg",
    description: "Statement heels with a refined finish.",
  },
  {
    title: "Kids Collection",
    slug: "kids-collection",
    image: "/images/products/kids-collection.jpg",
    description: "Durable pairs for active little steps.",
  },
  {
    title: "New Arrivals",
    slug: "new-arrivals",
    image: "/images/products/new-arrivals.jpg",
    description: "Fresh styles selected for the season.",
  },
];

type SeedProduct = {
  id: string;
  name: string;
  categorySlug: string;
  priceValue: number;
  wholesalePriceValue?: number;
  minWholesaleQty?: number;
  image: string;
  badge?: string;
  description: string;
  stock: number;
  featured?: boolean;
  bestSeller?: boolean;
  newArrival?: boolean;
};

function seedProduct(product: SeedProduct): Product {
  const category = categories.find((item) => item.slug === product.categorySlug) ?? categories[0];

  return {
    ...product,
    sku: product.id.toUpperCase(),
    category: category.title,
    price: formatPrice(product.priceValue),
    wholesalePriceValue: product.wholesalePriceValue ?? 0,
    minWholesaleQty: product.minWholesaleQty ?? 1,
    gallery: [product.image],
    rating: "4.8",
    longDescription:
      "A KRISHOE-selected pair built around everyday comfort, durable finishing, and a polished silhouette for Nepal-ready styling.",
    material: "Premium synthetic finish",
    fit: "Regular fit",
    colors: ["Black", "Tan"],
    sizes: ["36", "37", "38", "39", "40"],
    highlights: [
      "Comfort-focused base",
      "Clean premium profile",
      "Easy to style for daily wear",
    ],
    care: ["Wipe clean with a soft cloth", "Keep away from direct heat after use"],
    reviews: [],
    status: "Active",
    featured: Boolean(product.featured),
    bestSeller: Boolean(product.bestSeller),
    newArrival: Boolean(product.newArrival),
  };
}

export const products: Product[] = [
  seedProduct({
    id: "ladies-sandals",
    name: "Signature Ladies Sandals",
    categorySlug: "ladies-sandals",
    priceValue: 199900,
    wholesalePriceValue: 149900,
    minWholesaleQty: 6,
    image: "/images/products/ladies-sandals.png",
    badge: "New",
    description: "Polished strap detailing with a cushioned base for long days.",
    stock: 18,
    featured: true,
    bestSeller: true,
    newArrival: true,
  }),
  seedProduct({
    id: "ladies-slippers",
    name: "Cloud Step Slippers",
    categorySlug: "ladies-slippers",
    priceValue: 99900,
    image: "/images/products/ladies-slippers.png",
    badge: "Everyday",
    description: "Easy slip-on comfort with a clean premium profile.",
    stock: 24,
    featured: true,
    bestSeller: true,
  }),
  seedProduct({
    id: "casual-shoes",
    name: "Urban Casual Shoes",
    categorySlug: "casual-shoes",
    priceValue: 229900,
    wholesalePriceValue: 179900,
    minWholesaleQty: 4,
    image: "/images/products/casual-shoes.jpg",
    badge: "Limited",
    description: "A smart casual pair made for office days and city walks.",
    stock: 14,
    featured: true,
    bestSeller: true,
  }),
  seedProduct({
    id: "party-heels",
    name: "Midnight Party Heels",
    categorySlug: "party-heels",
    priceValue: 249900,
    image: "/images/products/party-heels.jpg",
    badge: "Best Seller",
    description: "A dressed-up heel with balance, shine, and evening presence.",
    stock: 10,
    featured: true,
    bestSeller: true,
  }),
  seedProduct({
    id: "flat-sandals",
    name: "Minimal Flat Sandals",
    categorySlug: "ladies-sandals",
    priceValue: 149900,
    image: "/images/products/flat-sandals.png",
    badge: "Fresh",
    description: "A low-profile sandal with clean lines and easy styling.",
    stock: 21,
    newArrival: true,
  }),
  seedProduct({
    id: "wedges",
    name: "Soft Lift Wedges",
    categorySlug: "party-heels",
    priceValue: 219900,
    image: "/images/products/wedges.jpg",
    badge: "Premium",
    description: "Stable height with a soft inner feel for longer occasions.",
    stock: 15,
    newArrival: true,
  }),
  seedProduct({
    id: "kids-runner",
    name: "Kids Daily Runner",
    categorySlug: "kids-collection",
    priceValue: 179900,
    image: "/images/products/kids-collection.jpg",
    badge: "Durable",
    description: "A sturdy, flexible pair for school days and play.",
    stock: 19,
  }),
  seedProduct({
    id: "seasonal-arrival",
    name: "Seasonal Arrival Pair",
    categorySlug: "new-arrivals",
    priceValue: 189900,
    image: "/images/products/new-arrivals.jpg",
    badge: "Just In",
    description: "A fresh seasonal style with a refined everyday finish.",
    stock: 16,
    newArrival: true,
  }),
];

export const featuredProducts = products.filter((product) => product.featured);
export const bestSellerProducts = products.filter((product) => product.bestSeller);
export const newArrivalProducts = products.filter((product) => product.newArrival);

export function getProductByIdFromList(items: Product[], id: string) {
  return items.find((product) => product.id === id);
}

export function getProductById(id: string) {
  return getProductByIdFromList(products, id);
}

export function getRelatedProductsFromList(items: Product[], product: Product) {
  return items
    .filter((item) => item.id !== product.id && item.categorySlug === product.categorySlug)
    .concat(items.filter((item) => item.id !== product.id && item.categorySlug !== product.categorySlug))
    .slice(0, 4);
}

export function getRelatedProducts(product: Product) {
  return getRelatedProductsFromList(products, product);
}

export function searchProductList(items: Product[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return items;
  }

  return items.filter((product) =>
    [product.name, product.category, product.description]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery),
  );
}

export function searchProducts(query: string) {
  return searchProductList(products, query);
}
