import { describe, expect, it, vi } from "vitest";

const navigation = vi.hoisted(() => ({
  redirect: vi.fn(),
}));

vi.mock("next/navigation", () => navigation);

import LegacyAddWorkV2Page from "@/app/admin/factory/add-work-v2/page";

describe("legacy factory add-work route", () => {
  it("keeps old bookmarks on the canonical work-entry workflow", () => {
    LegacyAddWorkV2Page();

    expect(navigation.redirect).toHaveBeenCalledWith("/admin/factory/add-work");
  });
});
