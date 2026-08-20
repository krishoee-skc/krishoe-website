import { describe, expect, it } from "vitest";
import { fingerprintFailure } from "@/lib/error-fingerprint";

/**
 * Top Errors is a ranked list, and a ranking is only worth reading if the same
 * fault lands on the same line. Grouped on the raw message it never did: every
 * reportError call names the work in hand — the bill number, the order
 * reference — so one fault that struck fifty orders was fifty rows each
 * reading 1x, and nothing in the list stood out from anything else.
 */
describe("grouping failures", () => {
  it("puts the same fault on one line however many orders it struck", () => {
    const first = fingerprintFailure("post bill INV-1183 failed: Error: connection terminated");
    const second = fingerprintFailure("post bill INV-9042 failed: Error: connection terminated");

    expect(second).toBe(first);
  });

  it("masks the shapes that differ per occurrence", () => {
    const cases = [
      ["send receipt for ORD-4471", "send receipt for ORD-88"],
      ["load 2f6c1a90-1b3e-4b8a-9f21-0c5d7e2a1b44", "load 91ab77de-0000-4111-8222-333344445555"],
      ["settled at 2026-08-21T10:04:00.000Z", "settled at 2026-01-02T23:59:59.500Z"],
      ["wage of 4250 paisa", "wage of 118000 paisa"],
      ['no product named "Doctor Chappal moto"', 'no product named "jeans shoes"'],
    ];

    for (const [left, right] of cases) {
      expect(fingerprintFailure(left), left).toBe(fingerprintFailure(right));
    }
  });

  it("keeps genuinely different faults apart", () => {
    const timeout = fingerprintFailure("post bill INV-1183 failed: connection terminated");
    const missing = fingerprintFailure("post bill INV-1183 failed: product not found");

    expect(missing).not.toBe(timeout);
  });

  it("groups on the sentence, not the stack under it", () => {
    const stack = [
      "sync catalog stock failed: Error: timeout",
      "    at queryPostgres (lib/postgres/client.ts:131:9)",
      "    at async syncCatalog (lib/catalog.ts:44:3)",
    ].join("\n");

    expect(fingerprintFailure(stack)).toBe(
      fingerprintFailure("sync catalog stock failed: Error: timeout")
    );
  });

  it("stays short enough to index, and is never empty", () => {
    expect(fingerprintFailure("x".repeat(5000)).length).toBeLessThanOrEqual(200);
    expect(fingerprintFailure("")).toBe("unknown failure");
    expect(fingerprintFailure("   \n  ")).toBe("unknown failure");
  });
});
