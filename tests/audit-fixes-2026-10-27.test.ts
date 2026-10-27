import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { readWorkEntryScreen } from "./helpers/work-entry-screen";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The app audit, as the owner approved it on 2026-10-27 ("yi sabai milau").
 * Nothing that was on these screens is taken away.
 */
describe("Add work: a mistake is mended from the day's list", () => {
  it("lets the owner fix or take back an entry beside the form, through the ledger's own checks", async () => {
    const list = await read("app/admin/factory/add-work/TodayEntries.tsx");
    expect(list).toContain('fetch("/api/factory/ledger/edit"');
    expect(list).toContain('fetch("/api/factory/ledger/delete"');
    expect(list).toContain("form.reason.trim().length < 5");
    // Worker and shoe can be changed, the wage follows the rate on file.
    expect(list).toContain("worker_id: form.workerId");
    expect(list).toContain("item_id: form.itemId");
    expect(list).toContain("rate_per_pair: null");
    // The owner only, as on the piece ledger.
    const page = await read("app/admin/factory/add-work/page.tsx");
    expect(page).toContain('getSessionAdminRole(session!) === "Owner"');
    expect(page).toContain("canFix={canFix}");
    // The link to the ledger stays.
    expect(list).toContain('href="/admin/factory/ledger"');
  });

  it("offers today's workers as one-tap buttons, the list staying for everyone", async () => {
    const form = await readWorkEntryScreen();
    expect(form).toContain("const quickWorkers = (() => {");
    expect(form).toContain("chooseWorker(worker.id);");
    expect(form).toContain('id="work-worker"');
  });

  it("lets Tab go box to box, past the chips", async () => {
    const form = await readWorkEntryScreen();
    expect((form.match(/tabIndex=\{-1\}/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});

describe("Cut a bill: the shoe asked for daily is first, named in full", () => {
  it("sorts what sold most this month next after what is on the shelf", async () => {
    const picker = await read("app/admin/pos/_components/PosProductPicker.tsx");
    expect(picker).toContain("(b.soldRecently ?? 0) - (a.soldRecently ?? 0)");
    expect(picker).toContain('className="line-clamp-2 block break-words text-base font-black text-brand-green-ink">{item.design}');
    expect(picker).toContain('sizes="56px"');
    expect(picker).toContain("md:flex-wrap md:overflow-visible");
  });

  it("says how often a phone has bought, and what it took last", async () => {
    const page = await read("app/admin/pos/page.tsx");
    expect(page).toContain("customerHistory={customerHistory}");
    expect(page).toContain('.replace(/[^0-9]/g, "").slice(-10)');
    const bill = await read("app/admin/pos/_components/PosBillForm.tsx");
    expect(bill).toContain("customerHistory[phoneDigits.slice(-10)]");
    // What was there stays: billed-before name and the known customer's due.
    expect(bill).toContain('text("Billed before as", "पहिले यो नामले बिल:")');
    expect(bill).toContain('text("Known customer:", "पुरानो ग्राहक:")');
  });
});

describe("Dashboard: the week against the week before is a tap away", () => {
  it("links to the report's last seven days", async () => {
    const dash = await read("components/admin/OwnerDashboard.tsx");
    expect(dash).toContain('href="/admin/reports?period=week"');
    // What now stays first on a phone (owner, 2026-10-01, asked again 2026-10-27).
    expect(dash).toContain('id="what-now" className="max-lg:-order-1');
  });
});
