import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Letting a customer see their order, without letting anyone else.
 *
 * An order carries a name, a full delivery address and a phone number. If a
 * reference number alone opened it, anyone holding a photo of someone else's
 * receipt — or working through ids — could read all of that. So the phone on
 * the order is required too, and even then only a small view comes back.
 *
 * These tests are mostly about what must NOT happen, because that is the part
 * a future change would quietly undo.
 */

const orders = [
  {
    id: "KRI-1042",
    createdAt: "2026-08-18T04:00:00.000Z",
    name: "Sita Karki",
    phone: "+977 9855019351",
    email: "sita@example.com",
    address: "Pulchowk, Narayangadh, house 12",
    total: "Rs. 1,999",
    status: "Contacted",
    items: [{ productId: "p1", productName: "Doctor Chappal", size: "38", color: "black", quantity: 2 }],
  },
];

vi.mock("@/lib/submissions", () => ({
  getOrders: async () => orders,
}));

const limiter = vi.fn(async () => ({ limited: false }));
vi.mock("@/lib/rate-limit-store", () => ({
  checkAndRecordRateLimit: (...args: unknown[]) => limiter(...(args as [])),
}));

const { trackOrder, trackingStage } = await import("@/lib/order-tracking");

beforeEach(() => {
  limiter.mockClear();
  limiter.mockImplementation(async () => ({ limited: false }));
});

describe("finding your own order", () => {
  it("returns it when the reference and phone both match", async () => {
    const result = await trackOrder("KRI-1042", "9855019351");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.order.status).toBe("Contacted");
    expect(result.order.total).toBe("Rs. 1,999");
    expect(result.order.itemCount).toBe(2);
  });

  it("accepts the number however the customer writes it", async () => {
    // Saved as "+977 9855019351"; people type their own number from memory.
    for (const typed of ["9855019351", "+9779855019351", "977-9855019351", "0 9855019351"]) {
      const result = await trackOrder("KRI-1042", typed);
      expect(result.ok, typed).toBe(true);
    }
  });

  it("does not care about the case of the reference", async () => {
    expect((await trackOrder("kri-1042", "9855019351")).ok).toBe(true);
  });
});

describe("what it refuses", () => {
  it("will not open an order on the reference alone", async () => {
    // The whole point: a leaked or guessed reference is not a key.
    const result = await trackOrder("KRI-1042", "9800000000");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("not-found");
  });

  it("says the same thing for a wrong number as for no such order", async () => {
    const wrongPhone = await trackOrder("KRI-1042", "9800000000");
    const noSuchOrder = await trackOrder("KRI-9999", "9855019351");

    // Different answers here would confirm which references exist.
    expect(wrongPhone).toEqual(noSuchOrder);
  });

  it("refuses a phone too short to identify anyone", async () => {
    expect((await trackOrder("KRI-1042", "12345")).ok).toBe(false);
  });

  it("stops after too many attempts", async () => {
    limiter.mockImplementation(async () => ({ limited: true }));
    const result = await trackOrder("KRI-1042", "9855019351");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // Without this, requiring the phone only slows an attacker down: a known
    // reference plus a run through plausible numbers would eventually match.
    expect(result.reason).toBe("rate-limited");
  });

  it("asks for both fields before searching at all", async () => {
    expect((await trackOrder("", "9855019351")).ok).toBe(false);
    expect((await trackOrder("KRI-1042", "")).ok).toBe(false);
    // Nothing was looked up, so nothing counted against the limit.
    expect(limiter).not.toHaveBeenCalled();
  });
});

describe("what comes back", () => {
  it("never returns the address, the name or the email", async () => {
    const result = await trackOrder("KRI-1042", "9855019351");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const returned = JSON.stringify(result.order);

    // The person entitled to these already knows them; nobody else should
    // learn them here.
    expect(returned).not.toContain("Pulchowk");
    expect(returned).not.toContain("Sita Karki");
    expect(returned).not.toContain("sita@example.com");
  });
});

describe("what the status means to the person waiting", () => {
  it("translates the order desk's words into an answer", () => {
    // "Contacted" tells a customer nothing about whether shoes are coming.
    expect(trackingStage("Contacted").ne).toContain("तयारी");
    expect(trackingStage("New").ne).toContain("आइपुग्यो");
    expect(trackingStage("Closed").step).toBe(3);
  });

  it("gives a cancelled order no progress bar", () => {
    expect(trackingStage("Cancelled").step).toBe(0);
  });
});
