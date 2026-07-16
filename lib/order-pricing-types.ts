// Shared checkout item shape. Kept apart from order-pricing.ts so client code
// can use it without pulling the server-only product store into the bundle.
export type CheckoutItemInput = {
  productId: string;
  quantity: number;
};
