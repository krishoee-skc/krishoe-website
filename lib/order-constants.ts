// The order and payment vocabularies, kept in a plain module both sides can
// import. lib/submissions pulls in node:fs and pg, so it cannot enter a client
// bundle; the admin actions file is "use server", which may only export async
// functions. This file has neither constraint, so the OrdersClient dropdowns
// and the server code share one list — add a status here and it appears in both.
export const orderStatuses = ["New", "Contacted", "Closed", "Cancelled"] as const;
export const paymentStatuses = ["Unpaid", "Pending", "Paid", "Failed", "Refunded"] as const;
export const paymentProviders = ["manual", "cod", "esewa", "khalti", "bank", "cash"] as const;
export const contactStatuses = ["New", "Replied"] as const;
