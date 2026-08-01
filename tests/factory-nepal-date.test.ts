import { describe, expect, it } from "vitest";
import {
  nepalDateKey,
  nepalMonthKey,
} from "@/app/admin/factory/_components/nepal-date";

describe("Factory Nepal date defaults", () => {
  it("uses the Nepal day when UTC is still on the previous day", () => {
    const afterNepalMidnight = new Date("2026-07-31T18:45:00.000Z");

    expect(afterNepalMidnight.toISOString().slice(0, 10)).toBe("2026-07-31");
    expect(nepalDateKey(afterNepalMidnight)).toBe("2026-08-01");
    expect(nepalMonthKey(afterNepalMidnight)).toBe("2026-08");
  });

  it("changes day exactly at Nepal midnight", () => {
    expect(nepalDateKey(new Date("2026-08-01T18:14:59.999Z"))).toBe("2026-08-01");
    expect(nepalDateKey(new Date("2026-08-01T18:15:00.000Z"))).toBe("2026-08-02");
  });

  it("keeps month and year boundaries in the Nepal timezone", () => {
    const nepalNewYear = new Date("2026-12-31T18:15:00.000Z");

    expect(nepalDateKey(nepalNewYear)).toBe("2027-01-01");
    expect(nepalMonthKey(nepalNewYear)).toBe("2027-01");
  });

  it("rejects an invalid date", () => {
    expect(() => nepalDateKey(new Date(Number.NaN))).toThrow(RangeError);
  });
});
