import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");
const nepaliWords = (source: string) => (source.match(/[ऀ-ॿ]+/g) ?? []).length;

/** The owner's sample, part 7घ (2026-10-14): the system's weakest pages. */
describe("SMS", () => {
  it("is in both languages, three figures and a period", async () => {
    const panel = await read("components/admin/SMSManagementPanel.tsx");
    expect(nepaliWords(panel)).toBeGreaterThan(50);
    expect(panel).toContain("fetch(`/api/admin/sms-logs?stats=true&days=${days}`)");
    expect(panel).not.toContain("SMS Management");
  });
});

describe("WhatsApp settings", () => {
  it("says whether it is really connected, and no longer offers a switch that saves nothing", async () => {
    const page = await read("app/admin/settings/whatsapp/page.tsx");
    expect(page).toContain("process.env.TWILIO_ACCOUNT_SID?.trim()");
    expect(page).toContain('<T en="✅ Connected" ne="✅ जोडिएको छ" />');
    expect(page).not.toContain("setWhatsappEnabled");
    expect(page).not.toContain('"use client"');
    const form = await read("app/admin/settings/whatsapp/WhatsAppTestForm.tsx");
    expect(form).toContain("disabled={isLoading || !connected}");
  });
});

describe("Barcode labels", () => {
  it("chooses the shoes and how many stickers of each", async () => {
    const sheet = await read("app/admin/products/labels/LabelSheet.tsx");
    expect(sheet).toContain("Array.from({ length: copies }");
    expect(sheet).toContain('className="grid gap-3 rounded-2xl border border-brand-green-line bg-brand-paper p-4 print:hidden"');
  });
});

describe("Small ones", () => {
  it("speaks both languages on the forbidden, security, analytics and notifications pages", async () => {
    expect(await read("app/admin/forbidden/page.tsx")).toContain('<T en="This page is not assigned to your role." ne="यो पाना तपाईंको भूमिकामा छैन।" />');
    expect(await read("app/admin/security/page.tsx")).toContain("<T en={link.note} ne={link.noteNe} />");
    expect(await read("components/admin/AdvancedAnalyticsDashboard.tsx")).toContain("const { text } = useLanguage();");
    const notifications = await read("app/admin/notifications/page.tsx");
    expect(notifications.match(/<ul className="grid list-none gap-2 pl-0 md:hidden">/g)?.length).toBe(2);
  });
});
