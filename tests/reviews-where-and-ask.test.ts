import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { customersToAsk, mobileDigits, reviewStats, whatsappTo } from "@/lib/review-ask-rules";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * Customer Voice (owner, 2026-10-01, choices 1 2 3): says where reviews show
 * up and counts them, tells the Owner's phone when a customer writes, and
 * lists counter customers to ask on WhatsApp.
 */
const now = new Date("2026-10-01T06:00:00Z");
const bill = (over: Partial<Parameters<typeof customersToAsk>[0][number]>) => ({
  invoiceNumber: "KRB-0001",
  createdAt: "2026-09-29T06:00:00Z",
  kind: "Sale",
  status: "Paid",
  customerName: "Sita",
  phone: "9812345678",
  note: "",
  items: [{ design: "bantu hill" }],
  ...over,
});

describe("1. the counts", () => {
  it("averages the rated reviews and counts the live ones", () => {
    expect(reviewStats([])).toEqual({ reviews: 0, average: 0, live: 0 });
    expect(
      reviewStats([
        { kind: "review", rating: 5, published: true },
        { kind: "review", rating: 3, published: false },
        { kind: "review", rating: 0, published: false },
        { kind: "question", rating: 0, published: false },
      ]),
    ).toEqual({ reviews: 3, average: 4, live: 1 });
  });

  it("says on the page where reviews show up", async () => {
    const page = await read("app/admin/inbox/page.tsx");
    expect(page).toContain("data-review-where");
    expect(page).toContain("data-review-stats");
  });
});

describe("2. the Owner's phone hears of it", () => {
  it("pushes after the row is safe, never failing the save, and not for app notes", async () => {
    const voice = await read("lib/customer-voice.ts");
    expect(voice).toContain('if (voice.kind !== "app") {');
    expect(voice).toContain("await tellOwnerNewVoice(voice);");
    expect(voice).toContain('reportError("tell the owner of a customer\'s message", error);');
    const notes = await read("lib/notifications.ts");
    expect(notes).toContain('url: "/admin/inbox?status=new",');
    expect(notes).toContain("tag: `voice-${voice.id}`,");
  });

  it("puts a waiting customer on the dashboard", async () => {
    const page = await read("app/admin/page.tsx");
    expect(page).toContain('key: "customer-voice",');
  });
});

describe("3. counter customers to ask", () => {
  it("keeps Nepali mobiles only, and adds the country code for WhatsApp", () => {
    expect(mobileDigits("981-234-5678")).toBe("9812345678");
    expect(mobileDigits("+977 9812345678")).toBe("9812345678");
    expect(mobileDigits("01-4412345")).toBe("");
    expect(whatsappTo("9812345678")).toBe("9779812345678");
  });

  it("lists recent sale bills with a phone, newest first, one row a customer", () => {
    const list = customersToAsk(
      [
        bill({ invoiceNumber: "KRB-0001", createdAt: "2026-09-20T06:00:00Z" }),
        bill({ invoiceNumber: "KRB-0002", createdAt: "2026-09-28T06:00:00Z" }),
        bill({ invoiceNumber: "KRB-0003", phone: "", customerName: "Walk-in" }),
        bill({ invoiceNumber: "KRB-0004", phone: "9800000001", status: "Voided" }),
        bill({ invoiceNumber: "KRB-0005", phone: "9800000002", status: "Returned" }),
        bill({ invoiceNumber: "KRB-0006", phone: "9800000003" }),
        bill({ invoiceNumber: "KRR-0001", kind: "Return", phone: "9800000003", note: "Return of KRB-0006" }),
        bill({ invoiceNumber: "KRB-0007", phone: "9800000004", createdAt: "2026-08-01T06:00:00Z" }),
        bill({ invoiceNumber: "KRB-0008", phone: "9800000005", items: [{ design: "doctor chappal" }, { design: "x" }] }),
      ],
      ["+977-9800000005"],
      now,
    );
    expect(list.map((row) => row.billNumber)).toEqual(["KRB-0002"]);
    expect(list[0]).toMatchObject({ phone: "9812345678", name: "Sita", shoe: "bantu hill" });
  });

  it("asks only whoever may read the bills, and sends nothing by itself", async () => {
    const page = await read("app/admin/inbox/page.tsx");
    expect(page).toContain('canAdmin(role, "pos:read")');
    const ask = await read("app/admin/inbox/AskCounterCustomers.tsx");
    expect(ask).toContain("href={`https://wa.me/${whatsappTo(customer.phone)}?text=${encodeURIComponent(message)}`}");
    expect(ask).not.toMatch(/fetch\(|Action\(/);
  });
});
