import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { isOrderComingBack } from "@/lib/order-cancel-reasons";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const sent = { dispatchedAt: "2026-09-29T08:00:00.000Z", cancelReason: "" };

/**
 * "Coming back" (owner, 2026-09-29). Cancelling a sent order freed its pairs
 * for the website while they were still with the courier, so they could be
 * sold twice before they reached the shop. A sent order now stays Contacted —
 * still holding its pairs — while it comes back, and is cancelled only when
 * the pairs are in the shop again.
 */
describe("a sent order the customer did not take", () => {
  it("is coming back only when it was sent, has a reason and is not yet cancelled", () => {
    expect(isOrderComingBack("Contacted", { ...sent, cancelReason: "Refused at the door" })).toBe(true);
    expect(isOrderComingBack("Contacted", sent)).toBe(false);
    expect(isOrderComingBack("Contacted", { dispatchedAt: "", cancelReason: "Size did not fit" })).toBe(false);
    expect(isOrderComingBack("Cancelled", { ...sent, cancelReason: "Size did not fit" })).toBe(false);
    expect(isOrderComingBack("Contacted", undefined)).toBe(false);
  });

  it("keeps holding its pairs while it comes back: the status is not touched", async () => {
    const source = await read("lib/order-dispatch.ts");
    const start = source.slice(source.indexOf("export async function startOrderReturn"), source.indexOf("export async function cancelOrderReturn"));
    expect(start).toContain("SET cancel_reason = $2");
    expect(start).not.toMatch(/status\s*=\s*'Cancelled'/);
    expect(start).toContain("status = 'Contacted' AND dispatched_at IS NOT NULL");
  });

  it("lets the pairs go only from an order marked coming back, in one statement", async () => {
    const source = await read("lib/order-dispatch.ts");
    const returned = source.slice(source.indexOf("export async function orderReturned"));
    expect(returned).toContain("SET status = 'Cancelled'");
    expect(returned).toContain("status = 'Contacted' AND dispatched_at IS NOT NULL AND cancel_reason <> ''");
  });

  it("\"Not sent after all\" cannot undo the sending of an order that is coming back", async () => {
    const source = await read("lib/order-dispatch.ts");
    const clear = source.slice(source.indexOf("export async function clearOrderDispatch"), source.indexOf("export async function startOrderReturn"));
    expect(clear).toContain("AND cancel_reason = ''");
  });

  it("refuses a plain cancel of a sent order, from the desk and from the status box", async () => {
    const actions = await read("app/admin/actions.ts");
    const cancel = actions.slice(actions.indexOf("export async function cancelOrderWithReasonAction"), actions.indexOf("const SENT_ORDER_CANCEL_MESSAGE"));
    expect(cancel).toContain("if (await orderWasSent(id)) return { ok: false, message: SENT_ORDER_CANCEL_MESSAGE };");
    const status = actions.slice(actions.indexOf("export async function updateOrderStatusAction"));
    expect(status).toContain('validatedFields.data.status === "Cancelled" && (await orderWasSent(validatedFields.data.id))');
  });

  it("refreshes the shop when the pairs go back on sale", async () => {
    const actions = await read("app/admin/actions.ts");
    const returned = actions.slice(actions.indexOf("export async function orderReturnedAction"), actions.indexOf("export async function updateOrderStatusAction"));
    expect(returned).toContain('revalidatePath("/", "layout")');
  });

  it("the desk offers Coming back, not Cancel, on a sent order, and no bill while it comes back", async () => {
    const desk = await read("app/admin/OrdersClient.tsx");
    expect(desk).toContain("run(stage === 2 ? startOrderReturnAction : cancelOrderWithReasonAction");
    expect(desk).toContain("run(orderReturnedAction, { id: order.id })");
    expect(desk).toContain("(stage === 1 || stage === 2) && !comingBack && !stockShort");
  });
});
