import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Settings read like settings (owner, 2026-09-28): a list of parts, one open
 * at a time, what is still empty at the top, and nothing shown twice.
 *
 * The risky part is the company form. One action saves every company field,
 * and it now sits in four smaller forms — shop, bill, bank, reviews. Each must
 * carry the fields it does not show, unchanged, or saving the bank details
 * would blank the shop's phone and PAN.
 */
const PAGE = "app/admin/settings/page.tsx";
const SECTIONS = "app/admin/settings/SettingsSections.tsx";

async function page() {
  return readFile(PAGE, "utf8");
}

describe("the company fields survive a partial save", () => {
  it("the action keeps any field a form did not send", async () => {
    const action = await readFile("app/admin/settings/actions.ts", "utf8");
    const save = action.slice(action.indexOf("export async function saveCompanySettingsAction"), action.indexOf("/** Rupees as typed"));
    expect(save).toContain("const current = (await getAdminSettings()).company;");
    expect(save).toContain("formData.has(key) ? textValue(formData, key) : String(current[key] ?? \"\")");
    // Every text field goes through pick(), none straight from the form.
    expect(save).not.toMatch(/: textValue\(formData, "(phone|panVatNumber|bankAccountNumber|address)"\)/);
    // The switch keeps its value unless the form that shows it was sent.
    expect(save).toContain("formData.has(\"promoEnabledShown\")");
  });

  it("the company is saved from four smaller forms, the switch marked in its own", async () => {
    const source = await page();
    expect(source.split("<form action={saveCompanySettingsAction}").length - 1).toBe(4);
    expect(source).toContain('<input type="hidden" name="promoEnabledShown" value="1" />');
    // No stale copies of other parts travel with a form.
    expect(source).not.toContain("KeepCompanyFields");
  });
});

describe("one part at a time", () => {
  it("has the seven parts, and what is still empty at the top", async () => {
    const source = await page();
    for (const id of ["shop", "bill", "delivery", "goal", "branch", "staff", "system"]) {
      expect(source, id).toContain(`{ id: "${id}"`);
    }
    expect(source).toContain("<SettingsSections sections={sections} todos={todos} />");
  });

  it("hides a closed part with its class, not only the attribute", async () => {
    const sections = await readFile(SECTIONS, "utf8");
    expect(sections).toContain('className={section.id === open ? "grid gap-5" : "hidden"}');
  });

  it("still opens the goal part from the dashboard's #goals link", async () => {
    const sections = await readFile(SECTIONS, "utf8");
    expect(sections).toContain('goals: "goal"');
  });

  it("keeps the staff access history, folded beside the staff", async () => {
    const source = await page();
    expect(source).toContain("accessHistory.map((entry) =>");
    expect(source).not.toContain("Immutable security trail");
  });

  it("names a device the way a person would", async () => {
    const staff = await readFile("components/admin/StaffAccessManager.tsx", "utf8");
    expect(staff).toContain("adminDeviceLabel(member.lastLoginUserAgent)");
    expect(staff).not.toContain("member.lastLoginUserAgent.slice(0, 45)");
  });
});
