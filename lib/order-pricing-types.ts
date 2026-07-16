// Shared checkout item shape. Kept apart from order-pricing.ts so client code
// can use it without pulling the server-only product store into the bundle.
export type CheckoutItemInput = {
  productId: string;
  quantity: number;
  // Chosen variant, carried through so the admin knows what to pack. These do
  // not affect price or availability — the catalog holds one stock number per
  // product, not per size — so client-supplied values are harmless here.
  size?: string;
  color?: string;
};
