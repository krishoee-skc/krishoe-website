import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Owner, 2026-10-08, from the Enter-and-speed compare: Enter walks every entry
 * screen and saves none by itself; the discount box never sends the order; the
 * ad libraries wait until the page is up.
 */
describe("Enter on the checkout's discount box", () => {
  it("checks the code and does not send the order", async () => {
    const source = await read("components/CheckoutClient.tsx");
    expect(source).toContain('if (event.key !== "Enter" || event.nativeEvent.isComposing) return;');
    expect(source).toContain("askAboutCoupon(event.currentTarget.value, event.currentTarget.form, 0);");
    expect(source).toContain("}, wait);");
  });
});

describe("Enter walks the money forms", () => {
  it("on every cheque form that takes figures", async () => {
    const source = await read("app/admin/cheques/page.tsx");
    expect(source.match(/<EnterWalkForm /g)?.length).toBe(4);
    expect(source).toContain('name="bankCharge" inputMode="numeric" data-summary="money"');
  });

  it("on the worker's advance request, asking in Nepali whatever the phone was set to", async () => {
    const source = await read("app/worker/ask/AskForm.tsx");
    expect(source).toContain("<EnterWalkForm action={action} worker");
    const walk = await read("components/admin/EnterWalkForm.tsx");
    expect(walk).toContain("const text = (english: string, nepali: string) => (worker ? nepali : chosen(english, nepali));");
    expect(walk).toContain('const ask = worker ? text("Send?", "पठाउने?") : text("Save?", "Save गर्ने?");');
    expect(walk).toContain('text("Yes, send (Enter)", "हो, पठाउने (Enter)")');
    expect(source).toContain('data-summary="money"');
  });
});

describe("Enter walks the screens with no form", () => {
  const screens = [
    "app/admin/factory/photos/WorkerInbox.tsx",
    "app/admin/factory/add-work/ReadyToPost.tsx",
    "app/admin/factory/items/ItemList.tsx",
    "app/admin/factory/workers/WorkerAppPanel.tsx",
    "app/worker/photos/WorkerPhotoForm.tsx",
  ];

  it.each(screens)("%s", async (file) => {
    const source = await read(file);
    expect(source).toContain('import EnterWalkGroup from "@/components/admin/EnterWalkGroup";');
    expect(source.match(/<EnterWalkGroup /g)?.length).toBe(source.match(/<\/EnterWalkGroup>/g)?.length);
  });

  it("lands on the save button and never presses it", async () => {
    const group = await read("components/admin/EnterWalkGroup.tsx");
    expect(group).toContain('else if (step.kind === "confirm") go(saveButtonAfter(group, target));');
    expect(group).not.toContain(".click()");
    expect(group).not.toContain("requestSubmit");
  });

  it("shows Next on the phone keyboard in the bill and the work entry", async () => {
    expect((await read("app/admin/factory/add-work/WorkEntryForm.tsx")).match(/enterKeyHint="next"/g)?.length).toBe(7);
    expect((await read("app/admin/purchasing/_components/PurchaseInvoiceForm.tsx")).match(/enterKeyHint="next"/g)?.length).toBe(11);
  });
});

describe("the ad libraries wait for the page", () => {
  it("lets the Meta library report its own errors", async () => {
    const config = await read("next.config.js");
    expect(config).toMatch(/"img-src [^"]*https:\/\/connect\.facebook\.net /);
  });

  it("loads Meta, GA and TikTok after the page, keeping Meta's and GA's queue from the start", async () => {
    const source = await read("components/commerce/Analytics.tsx");
    expect(source).toContain('<Script src="https://connect.facebook.net/en_US/fbevents.js" strategy="lazyOnload" />');
    expect(source).toContain('<Script id="meta-pixel" strategy="afterInteractive">');
    expect(source).toContain("n.queue=[]}(window);");
    expect(source).not.toContain("insertBefore");
    expect(source).toContain('<Script id="ga4" strategy="afterInteractive">');
    expect(source).toContain('<Script id="tiktok-pixel" strategy="lazyOnload">');
    expect(source.match(/strategy="lazyOnload"/g)?.length).toBe(3);
  });

  it("does not fetch the sign-in font on every shop page", async () => {
    const layout = await read("app/layout.tsx");
    expect(layout).toMatch(/variable: "--font-tech",\n {2}display: "swap",\n(?: {2}\/\/.*\n)* {2}preload: false,/);
  });
});
