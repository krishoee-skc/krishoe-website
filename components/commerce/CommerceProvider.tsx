"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { formatPrice, type Product } from "@/lib/products";
import { findStockShortfalls, type StockShortfall } from "@/lib/order-stock";

type CartItem = {
  productId: string;
  size: string;
  color: string;
  quantity: number;
};

type DetailedCartItem = CartItem & {
  key: string;
  name: string;
  image: string;
  price: string;
  priceValue: number;
  lineTotal: number;
  // Pairs the catalog has for this product, across every line of the cart.
  // A product can sit on several lines (one per size), so a line being under
  // stock does not mean the cart is.
  available: number;
};

type CommerceContextValue = {
  products: Product[];
  cart: CartItem[];
  cartItems: DetailedCartItem[];
  wishlist: string[];
  cartCount: number;
  wishlistCount: number;
  subtotal: number;
  subtotalLabel: string;
  stockShortfalls: StockShortfall[];
  canCheckout: boolean;
  addToCart: (item: CartItem) => void;
  removeFromCart: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  toggleWishlist: (productId: string) => void;
  isWishlisted: (productId: string) => boolean;
};

const CommerceContext = createContext<CommerceContextValue | null>(null);

const cartKey = "krishoe-cart";
const wishlistKey = "krishoe-wishlist";

function itemKey(item: Pick<CartItem, "productId" | "size" | "color">) {
  return `${item.productId}:${item.size}:${item.color}`;
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function CommerceProvider({
  children,
  catalogProducts,
}: {
  children: React.ReactNode;
  catalogProducts: Product[];
}) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [hasLoadedStorage, setHasLoadedStorage] = useState(false);
  const productById = useMemo(
    () => new Map(catalogProducts.map((product) => [product.id, product])),
    [catalogProducts],
  );

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCart(readJson<CartItem[]>(cartKey, []));
      setWishlist(readJson<string[]>(wishlistKey, []));
      setHasLoadedStorage(true);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (hasLoadedStorage) {
      window.localStorage.setItem(cartKey, JSON.stringify(cart));
    }
  }, [cart, hasLoadedStorage]);

  useEffect(() => {
    if (hasLoadedStorage) {
      window.localStorage.setItem(wishlistKey, JSON.stringify(wishlist));
    }
  }, [wishlist, hasLoadedStorage]);

  const addToCart = useCallback((item: CartItem) => {
    setCart((current) => {
      const key = itemKey(item);
      const existing = current.find((cartItem) => itemKey(cartItem) === key);

      if (existing) {
        return current.map((cartItem) =>
          itemKey(cartItem) === key
            ? { ...cartItem, quantity: Math.min(cartItem.quantity + item.quantity, 9) }
            : cartItem,
        );
      }

      return [...current, { ...item, quantity: Math.max(1, item.quantity) }];
    });
  }, []);

  const removeFromCart = useCallback((key: string) => {
    setCart((current) => current.filter((item) => itemKey(item) !== key));
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setCart((current) =>
      current.map((item) =>
        itemKey(item) === key ? { ...item, quantity: Math.max(1, Math.min(quantity, 9)) } : item,
      ),
    );
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const toggleWishlist = useCallback((productId: string) => {
    setWishlist((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }, []);

  const isWishlisted = useCallback(
    (productId: string) => wishlist.includes(productId),
    [wishlist],
  );

  const cartItems = useMemo<DetailedCartItem[]>(
    () =>
      cart.flatMap((item) => {
        const product = productById.get(item.productId);

        if (!product) {
          return [];
        }

        return [
          {
            ...item,
            key: itemKey(item),
            name: product.name,
            image: product.image,
            price: product.price,
            priceValue: product.priceValue,
            lineTotal: product.priceValue * item.quantity,
            available: Math.max(0, product.stock),
          },
        ];
      }),
    [cart, productById],
  );

  // The same rule the checkout enforces server-side, so the cart never promises
  // an order the server will then refuse.
  const stockShortfalls = useMemo(
    () =>
      findStockShortfalls(
        catalogProducts,
        cart.map((item) => ({ productId: item.productId, quantity: item.quantity })),
      ),
    [catalogProducts, cart],
  );

  const cartCount = cart.reduce((total, item) => total + item.quantity, 0);
  const wishlistCount = wishlist.filter((id) => productById.has(id)).length;
  const subtotal = cartItems.reduce((total, item) => total + item.lineTotal, 0);

  const value = useMemo<CommerceContextValue>(
    () => ({
      products: catalogProducts,
      cart,
      cartItems,
      wishlist,
      cartCount,
      wishlistCount,
      subtotal,
      subtotalLabel: formatPrice(subtotal),
      stockShortfalls,
      canCheckout: cartCount > 0 && stockShortfalls.length === 0,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleWishlist,
      isWishlisted,
    }),
    [
      catalogProducts,
      cart,
      cartItems,
      wishlist,
      cartCount,
      wishlistCount,
      subtotal,
      stockShortfalls,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      toggleWishlist,
      isWishlisted,
    ],
  );

  return <CommerceContext.Provider value={value}>{children}</CommerceContext.Provider>;
}

export function useCommerce() {
  const context = useContext(CommerceContext);

  if (!context) {
    throw new Error("useCommerce must be used inside CommerceProvider");
  }

  return context;
}
