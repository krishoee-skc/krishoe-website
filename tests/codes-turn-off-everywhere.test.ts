import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getCoupon = vi.fn();
const setCouponStatus = vi.fn();
const saveCoupon = vi.fn();
const redirect = vi.fn((url: string) => {
  throw Object.assign(new Error("NEXT_REDIRECT"), { url });
});

vi.mock("@/lib/coupons", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/coupons")>()),
  getCoupon: (...args: unknown[]) => getCoupon(...args),
  setCouponStatus: (...args: unknown[]) => setCouponStatus(...args),
  saveCoupon: (...args: unknown[]) => saveCoupon(...args),
}));
vi.mock("@/lib/admin-permissions", () => ({ requireAdminPermission: async () => ({ role: "Owner", session: { email: "owner@x" } }) }));
vi.mock("@/lib/admin-audit", () => ({ recordAdminAuditEvent: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: (url: string) => redirect(url) }));

import { saveCouponAction, switchCouponAction } from "@/app/admin/coupons/actions";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const wentTo = () => decodeURIComponent(String(redirect.mock.calls.at(-1)?.[0] ?? ""));
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
};
const coupon = (over: Record<string, unknown> = {}) => ({
  code: "DASHAINOFFER",
  kind: "percent",
  value: 10,
  minOrderPaisa: 0,
  maxDiscountPaisa: null,
  startsAt: null,
  expiresAt: null,
  maxUses: null,
  usedCount: 0,
  status: "Active",
  note: "",
  createdAt: "2026-10-12T09:44:48.162Z",
  ...over,
});

beforeEach(() => {
  getCoupon.mockReset();
  setCouponStatus.mockReset();
  saveCoupon.mockReset();
  redirect.mockClear();
});

/** Owner, 2026-10-21, the coupon sample: 1, 2 and 3. */
describe("1 · off and on from the code's own card", () => {
  it("turns a running code off in one press", async () => {
    getCoupon.mockResolvedValue(coupon());
    await expect(switchCouponAction(form({ code: "dashainoffer", to: "off" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(setCouponStatus).toHaveBeenCalledWith("DASHAINOFFER", "Disabled");
    expect(wentTo()).toContain("success=DASHAINOFFER बन्द भयो");
  });

  it("does not bring an ended code back on: the form opens on it for a new end date", async () => {
    getCoupon.mockResolvedValue(coupon({ code: "BESTOFDASHAIN", status: "Disabled", expiresAt: "2026-10-17T00:00:00.000Z" }));
    await expect(switchCouponAction(form({ code: "BESTOFDASHAIN", to: "on" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(setCouponStatus).not.toHaveBeenCalled();
    expect(wentTo()).toContain("error=यसको म्याद सकिइसकेको छ");
    expect(wentTo()).toContain("&edit=BESTOFDASHAIN#coupon-form");
  });

  it("nor one used as many times as it may be", async () => {
    getCoupon.mockResolvedValue(coupon({ status: "Disabled", maxUses: 5, usedCount: 5 }));
    await expect(switchCouponAction(form({ code: "DASHAINOFFER", to: "on" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(setCouponStatus).not.toHaveBeenCalled();
    expect(wentTo()).toContain("raise the limit first");
  });

  it("turns one with time left back on", async () => {
    getCoupon.mockResolvedValue(coupon({ status: "Disabled", expiresAt: "2099-01-01T00:00:00.000Z" }));
    await expect(switchCouponAction(form({ code: "DASHAINOFFER", to: "on" }))).rejects.toThrow("NEXT_REDIRECT");
    expect(setCouponStatus).toHaveBeenCalledWith("DASHAINOFFER", "Active");
  });

  it("has the buttons and an Edit that opens the form filled in", async () => {
    const page = await read("app/admin/coupons/page.tsx");
    expect(page).toContain('<T en="Turn off" ne="बन्द गर्ने" />');
    expect(page).toContain('<T en="Turn back on" ne="फेरि चालू गर्ने" />');
    expect(page).toContain("href={`/admin/coupons?edit=${encodeURIComponent(coupon.code)}#coupon-form`}");
    expect(page).toContain('defaultValue={editing?.code ?? ""}');
    expect(page).toContain("open={Boolean(params?.error) || Boolean(editing)}");
  });
});

describe("2 · an ended code is off everywhere", () => {
  it("is turned off at night, by the same rule checkout uses", async () => {
    const lib = await read("lib/coupons.ts");
    const sql = lib.slice(lib.indexOf("export async function turnOffEndedCoupons"));
    expect(sql).toContain("SET status = 'Disabled', updated_at = now()");
    expect(sql).toContain("AND ((expires_at IS NOT NULL AND (expires_at AT TIME ZONE 'UTC')::date < $1::date)");
    expect(sql).toContain("[nepalDay(now)],");
    expect(sql).toContain("OR (max_uses IS NOT NULL AND used_count >= max_uses))");
    const cron = await read("app/api/cron/daily-sales/route.ts");
    expect(cron).toContain('name: "coupon-ends",');
    expect(cron).toContain('expired: { en: "ended, turned off", ne: "म्याद सकियो, बन्द गरियो" },');
    expect(await read("lib/nightly-jobs.ts")).toContain('"coupon-ends": { en: "Ended discount codes turned off", ne: "सकिएका छुट code बन्द" },');
  });

  it("is said as off on its card, with why", async () => {
    const page = await read("app/admin/coupons/page.tsx");
    expect(page).toContain('(expired ? "Off · expired" : exhausted ? "Off · used up" : "Off")');
  });

  it("cannot be saved on with its end already gone by", async () => {
    await expect(
      saveCouponAction(form({ code: "BESTOFDASHAIN", kind: "percent", percent: "10", status: "Active", expiresAt: "2026-10-17" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(saveCoupon).not.toHaveBeenCalled();
    expect(wentTo()).toContain("give a new end date first");
  });
});

describe("3 · the rupee boxes", () => {
  it("asks before a ceiling under Rs 50 is saved", async () => {
    await expect(
      saveCouponAction(form({ code: "BESTOFDASHAIN", kind: "percent", percent: "10", maxDiscountRupees: "3" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(saveCoupon).not.toHaveBeenCalled();
    expect(wentTo()).toContain("बढीमा Rs 3 मात्र छुट");
  });

  it("saves it once the owner has said yes, and never asks about Rs 300", async () => {
    saveCoupon.mockResolvedValue(coupon());
    await expect(
      saveCouponAction(form({ code: "X10", kind: "percent", percent: "10", maxDiscountRupees: "3", lowCapYes: "yes" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(saveCoupon).toHaveBeenCalledWith(expect.objectContaining({ maxDiscountPaisa: 300 }));
    await expect(
      saveCouponAction(form({ code: "X10", kind: "percent", percent: "10", maxDiscountRupees: "300" })),
    ).rejects.toThrow("NEXT_REDIRECT");
    expect(saveCoupon).toHaveBeenLastCalledWith(expect.objectContaining({ maxDiscountPaisa: 30000 }));
  });

  it("shows Rs and % in front of the boxes, and asks on the form first", async () => {
    const page = await read("app/admin/coupons/page.tsx");
    expect(page.match(/<Unit mark="Rs">/g)).toHaveLength(2);
    expect(page).toContain('<Unit mark="%">');
    const box = await read("app/admin/coupons/CapBox.tsx");
    expect(await read("app/admin/coupons/cap.ts")).toContain("export const LOW_CAP_RUPEES = 50;");
    expect(box).toContain("event.preventDefault();");
    expect(box).toContain("box.current?.form?.requestSubmit();");
    expect(box).toContain('<input type="hidden" name="lowCapYes" value={said ? "yes" : ""} />');
  });
});
