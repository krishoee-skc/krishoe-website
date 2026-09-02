import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { daysWaiting, type CustomerVoice } from "@/lib/customer-voice";
import { adminNavLinks } from "@/app/admin/nav-links";

const MIGRATION = "scripts/migrations/20260823_customer_voice.sql";
const LIB = "lib/customer-voice.ts";
const PAGE = "app/admin/inbox/page.tsx";
const ACTIONS = "app/admin/inbox/actions.ts";

/** Source with comments removed. */
function code(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*(?:\/\/|\{\/\*).*$/gm, "");
}

function voice(over: Partial<CustomerVoice> = {}): CustomerVoice {
  return {
    id: "CV-1",
    createdAt: new Date().toISOString(),
    kind: "question",
    customerName: "राम",
    phone: "9841234567",
    email: "",
    productId: "",
    productName: "",
    orderId: "",
    rating: 0,
    message: "साइज ३२ छ?",
    status: "new",
    repliedAt: null,
    replyNote: "",
    published: false,
    source: "site",
    ...over,
  };
}

/**
 * What a customer said lived in four places, reached from four menu entries:
 * reviews as JSON inside the products row, contact_messages,
 * wholesale_enquiries, and a Feedback screen reading a user_feedback table that
 * was never created — its migration sat in a `migrations/` folder at the repo
 * root that nothing has ever read. Answering a customer meant opening four
 * screens and hoping none had been missed.
 */
describe("one place for what customers say", () => {
  it("keeps the kinds few enough to actually be filed", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    expect(sql).toContain("CHECK (kind IN ('review', 'question', 'complaint'))");
  });

  it("leaves wholesale where its own fields can survive", async () => {
    const sql = await readFile(MIGRATION, "utf8");
    const page = await readFile(PAGE, "utf8");

    // A shop asking for two hundred pairs a month is a pipeline with a shop
    // name, a location and a monthly quantity — not a message.
    expect(sql).not.toContain("'wholesale'");
    expect(code(page)).not.toContain('"wholesale"');
    expect(adminNavLinks.some((link) => link.href === "/admin/wholesale")).toBe(true);
  });

  it("records how long a customer has been waiting", async () => {
    const sql = await readFile(MIGRATION, "utf8");

    expect(sql).toContain("CHECK (status IN ('new', 'answered', 'closed'))");
    expect(sql).toContain("replied_at timestamptz");
  });
});

describe("how long someone has waited", () => {
  it("counts only what is still unanswered", () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 86_400_000).toISOString();

    expect(daysWaiting(voice({ createdAt: threeDaysAgo }))).toBe(3);
    // Answered is answered; the clock is about the customer, not the row.
    expect(daysWaiting(voice({ createdAt: threeDaysAgo, status: "answered" }))).toBe(0);
    expect(daysWaiting(voice({ createdAt: threeDaysAgo, status: "closed" }))).toBe(0);
  });

  it("never reports a negative wait", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();

    expect(daysWaiting(voice({ createdAt: future }))).toBe(0);
  });
});

describe("the inbox screen", () => {
  it("shouts when a question has sat three days", async () => {
    const page = await readFile(PAGE, "utf8");

    // Three days is where a question stops being a question and becomes a
    // customer who bought the pair somewhere else.
    expect(page).toContain("waited >= 3");
    expect(page).toContain("दिन भयो!");
  });

  it("puts answering one tap from the row", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("href={`tel:${phone}`}");
    expect(page).toContain("https://wa.me/");
    // The one-tap reply button, now bilingual (English shows in English mode).
    expect(page).toContain('<T en="Replied" ne="जवाफ दिएँ" />');
  });

  it("dials a Nepali number the way wa.me needs it", async () => {
    const page = await readFile(PAGE, "utf8");

    // Ten digits is a local number; wa.me wants the country code on it.
    expect(page).toContain('digits.length === 10 ? `977${digits}` : digits');
  });

  it("says nothing rather than an empty table", async () => {
    const page = await readFile(PAGE, "utf8");

    expect(page).toContain("अझै कुनै ग्राहकले केही भनेका छैनन्");
  });

  it("does not load every message ever received", async () => {
    const lib = await readFile(LIB, "utf8");

    // An inbox that loads everything gets slower every day it succeeds.
    expect(lib).toContain("Math.min(Math.max(Math.trunc(options?.limit ?? 200), 1), 500)");
    expect(lib).toContain("COUNT(*)::int AS n FROM customer_voice GROUP BY kind, status");
  });
});

describe("who may do what", () => {
  it("takes a stronger permission to publish than to file", async () => {
    const actions = await readFile(ACTIONS, "utf8");

    // Publishing puts a customer's words on a public page.
    expect(actions).toContain('requireAdminPermission("feedback:write")');
    expect(actions).toContain('requireAdminPermission("reviews:write")');
  });

  it("keeps a review off the storefront until the owner puts it there", async () => {
    const sql = await readFile(MIGRATION, "utf8");
    const lib = await readFile(LIB, "utf8");

    expect(sql).toContain("published boolean NOT NULL DEFAULT false");
    expect(lib).toContain("kind = 'review' AND published = true");
  });
});

describe("the menu the owner actually reads", () => {
  it("lists the inbox once, and the four it replaced not at all", () => {
    const hrefs = adminNavLinks.map((link) => link.href);

    expect(hrefs.filter((href) => href === "/admin/inbox")).toHaveLength(1);
    for (const gone of ["/admin/reviews", "/admin/feedback", "/admin/insights", "/admin/messages"]) {
      expect(hrefs, gone).not.toContain(gone);
    }
  });

  it("still answers the old addresses rather than 404ing a bookmark", async () => {
    for (const path of ["reviews", "messages", "feedback"]) {
      const page = await readFile(`app/admin/${path}/page.tsx`, "utf8");
      expect(page, path).toContain('redirect("/admin/inbox');
    }
  });

  it("keeps the permission guard on the addresses that still exist", async () => {
    // The pages redirect now, but the layouts are what hold the permission,
    // and deleting one would quietly widen who can reach the route.
    for (const path of ["reviews", "messages"]) {
      const layout = await readFile(`app/admin/${path}/layout.tsx`, "utf8");
      expect(layout, path).toContain("AdminPermissionLayout");
    }
  });
});

/**
 * A question typed into the contact form is the same kind of thing as a review
 * or a complaint. Writing it into its own table with its own screen is what
 * produced four screens in the first place.
 */
describe("where the contact form writes", () => {
  it("writes into the inbox, not a table of its own", async () => {
    const submissions = await readFile("lib/submissions.ts", "utf8");
    const save = submissions.slice(submissions.indexOf("export async function saveContactMessage"));

    expect(save).toContain("saveCustomerVoice({");
    expect(save).toContain('kind: "question"');
    expect(save).not.toContain("INSERT INTO contact_messages");
  });
});
