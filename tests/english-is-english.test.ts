import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The English side has to be English.
 *
 * The owner's rule, in their words: the app is built in Nepal and runs in
 * English; Nepali mode carrying the odd English word is fine, but pressing
 * ENGLISH has to give English and nothing else. A screen that answers in
 * Devanagari to someone who cannot read Devanagari is not a half-finished
 * translation — it is an unreadable screen.
 *
 * This file is the ratchet. Every Nepali line that is NOT half of a written
 * pair is counted, per file, and the counts below are what the app had on
 * 2026-08-26. A listed file may only ever go DOWN. A file NOT on the list may
 * not leak at all — so a new screen written the old way fails here, rather
 * than being found by the owner three weeks later.
 *
 * The list is deliberately long. It is the honest size of what is left: 912
 * lines across 75 files, after the eighteen daily screens, the admin menu and
 * the storefront were finished. Shortening it by loosening the check would be
 * lying about the work, so the only way a line comes off is by being paired.
 */

/** Any Devanagari at all. */
const DEVANAGARI = /[\u0900-\u097F]/;

/**
 * Everything that is already half of a pair, removed before counting.
 *
 * Both writing shapes the app uses — `text(en, ne)` inside client components,
 * `<T en ne />` and `<AlertText en ne />` in server ones — plus the object
 * properties that carry a Nepali half to them (`ne:`, `titleNe:`, `nepali:`).
 * Comments go too: an explanation written in Nepali for whoever maintains this
 * is not something a reader ever sees.
 */
function unpaired(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\btext\(\s*(["'`])[\s\S]*?\1\s*,\s*(["'`])[\s\S]*?\2\s*,?\s*\)/g, "")
    .replace(/<T\s[\s\S]*?\/>/g, "")
    .replace(/<AlertText[\s\S]*?\/>/g, "")
    .replace(/\bne=\{?\s*(["'`])[\s\S]*?\1\s*\}?/g, "")
    .replace(/\b(\w*[Nn]e|nepali)\s*:\s*(["'`])[\s\S]*?\2/g, "")
    // A whole declaration whose name ends Ne or _NE: a lookup table of Nepali
    // keyed by the English (`shippingLabelsNe`), or a Nepali array beside its
    // English twin (`WORDS_NE` / `WORDS_EN`). There the pair is the name.
    .replace(/\bconst\s+\w*(?:Ne|_NE)\b[^=]*=\s*[[{][\s\S]*?^\s*[\]}]/gm, "");
}

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".next" || entry === ".git") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...sourceFiles(path));
    else if (/\.tsx?$/.test(entry)) found.push(path.split("\\").join("/"));
  }
  return found;
}

function leakCount(file: string) {
  return unpaired(readFileSync(file, "utf8"))
    .split("\n")
    .filter((line) => DEVANAGARI.test(line)).length;
}

/**
 * The places that say both languages at once, on purpose, and why.
 *
 * Every one of these is somewhere the reader's choice is genuinely unknowable
 * or genuinely irrelevant. Nothing goes on this list because it was hard; a
 * reason that is really "not done yet" belongs in STILL_OWED, where it is
 * counted as work owed.
 *
 * The counts are held too — an exemption is for the lines named here, not a
 * licence for the file.
 */
const BILINGUAL_ON_PURPOSE: Record<string, { lines: number; why: string }> = {
  "components/LanguageSwitch.tsx": {
    lines: 1,
    why: "The word नेपाली on the button that switches to Nepali. A reader looking for it must find it whichever side they are on — that is the button's whole job.",
  },
  "components/LanguageInvite.tsx": {
    lines: 4,
    why: "The offer of Nepali, shown to someone currently reading English. Written in English it would not reach the person it is for.",
  },
  "app/global-error.tsx": {
    lines: 2,
    why: "Replaces the whole app, LanguageProvider included, when everything else has failed. There is no preference left to read, and a stranded reader who cannot understand the one line offered has nowhere to go.",
  },
  "lib/seo.ts": {
    lines: 3,
    why: "What Google is given to show. It is written before any reader arrives and it is how a Nepali search finds the shop at all.",
  },
  "app/faq/page.tsx": {
    lines: 2,
    why: "Search-result text — the page title and description Google indexes.",
  },
  "app/privacy/page.tsx": {
    lines: 2,
    why: "Search-result text — the page title and description Google indexes.",
  },
  "app/terms/page.tsx": {
    lines: 2,
    why: "Search-result text — the page title and description Google indexes.",
  },
  "app/track-order/page.tsx": {
    lines: 2,
    why: "Search-result text. A customer looking for their order searches in Nepali.",
  },
  "app/wholesale/page.tsx": {
    lines: 3,
    why: "Search-result text. A shopkeeper looking for a wholesale supplier searches in Nepali.",
  },
  "app/review/[token]/page.tsx": {
    lines: 1,
    why: "The browser tab on a per-customer link, chosen before the page runs.",
  },
  "app/wholesale/actions.ts": {
    lines: 10,
    why: "The enquiry email, which goes to the owner and nobody else. One reader, who reads Nepali, and no switch involved.",
  },
  "lib/coupons.ts": {
    lines: 4,
    why: "Thrown to whoever is typing a coupon on an admin screen. An exception carries no language context, so both sentences travel together.",
  },
};

/**
 * What each file still owes, as of 2026-08-26.
 *
 * Only ever edit a number downwards; a file that reaches zero comes off the
 * list entirely, and the third test below insists on it.
 */
const STILL_OWED: Record<string, number> = {
  "app/(admin-auth)/admin/forgot-password/page.tsx": 2,
  "app/(admin-auth)/admin/login/link/EmailLinkSignIn.tsx": 6,
  "app/(admin-auth)/admin/login/link/page.tsx": 4,
  "app/(admin-auth)/admin/reset-password/page.tsx": 2,
  "app/admin/AdminQuickDock.tsx": 6,
  "app/admin/ProductsClient.tsx": 7,
  "app/admin/TodayBoard.tsx": 9,
  "app/admin/coupons/actions.ts": 2,
  "app/admin/factory/_components/factory-nav.tsx": 7,
  "app/admin/factory/add-work/ReadyToPost.tsx": 24,
  "app/admin/factory/items/page.tsx": 9,
  "app/admin/factory/reports/page.tsx": 2,
  "app/admin/factory/worker-portal-qr/page.tsx": 3,
  "app/admin/getting-started/page.tsx": 8,
  "app/admin/inbox/page.tsx": 22,
  "app/admin/insights/page.tsx": 16,
  "app/admin/login/actions.ts": 4,
  "app/admin/login/passkey-actions.ts": 4,
  "app/admin/measurement/page.tsx": 54,
  "app/admin/open-on-phone/page.tsx": 3,
  "app/admin/operations/_components/LedgerTransactionFields.tsx": 1,
  "app/admin/operations/_components/OperationsQuickEntry.tsx": 6,
  "app/admin/operations/actions.ts": 25,
  "app/admin/page.tsx": 1,
  "app/admin/pos/[id]/page.tsx": 5,
  "app/admin/pos/actions.ts": 6,
  "app/admin/products/labels/page.tsx": 2,
  "app/admin/products/photo-guide/page.tsx": 60,
  "app/admin/products/photos/PhotoCard.tsx": 11,
  "app/admin/products/photos/actions.ts": 4,
  "app/admin/products/photos/page.tsx": 9,
  "app/admin/search/SearchAsYouType.tsx": 6,
  "app/admin/search/page.tsx": 3,
  "app/admin/security/page.tsx": 10,
  "app/admin/settings/actions.ts": 6,
  "app/admin/settings/whatsapp/page.tsx": 2,
  "app/admin/wholesale/actions.ts": 1,
  "app/admin/wholesale/page.tsx": 17,
  "app/admin/workers/analytics/page.tsx": 5,
  "app/api/admin/push/route.ts": 2,
  "app/api/admin/search/route.ts": 3,
  "app/api/cron/checkout-reminders/route.ts": 6,
  "app/api/factory/ready/route.ts": 3,
  "app/worker/dashboard/page.tsx": 15,
  "app/worker/payslip/page.tsx": 11,
  "app/worker/production/page.tsx": 8,
  "components/admin/AdminAccessForms.tsx": 4,
  "components/admin/BikramMonthPicker.tsx": 1,
  "components/admin/GoogleAnalyticsDashboard.tsx": 13,
  "components/admin/MonitoringDashboard.tsx": 31,
  "components/admin/PasskeyInvite.tsx": 12,
  "components/admin/PasskeyManager.tsx": 21,
  "components/admin/PushNotificationSetup.tsx": 20,
  "components/admin/QuickAdminHome.tsx": 15,
  "components/admin/StaffAccessManager.tsx": 1,
  "components/admin/StaffToday.tsx": 10,
  "components/admin/TodaySales.tsx": 10,
  "components/worker/WorkerPortalShell.tsx": 3,
  "components/worker/WorkerPortalUnavailable.tsx": 9,
  "lib/admin-search.ts": 42,
  "lib/factory-worker-options.ts": 3,
  "lib/google-analytics.ts": 10,
  "lib/login-alerts.ts": 2,
  "lib/notifications.ts": 41,
  "lib/passkeys.ts": 5,
  "lib/period-report.ts": 12,
  "lib/pos.ts": 2,
  "lib/push-notifications.ts": 1,
  "lib/search-words.ts": 13,
  "lib/sms-gateway.ts": 30,
  "lib/whatsapp-gateway.ts": 3,
  "lib/worker-auth.ts": 2,
};

/**
 * The screens the owner and the staff open every day, held at zero by name.
 *
 * Without this the ratchet could be satisfied by finishing quiet files while
 * the till and the wage book quietly drifted back.
 */
const DAILY = [
  "app/admin/ProductForm.tsx",
  "app/admin/products/page.tsx",
  "app/admin/pos/_components/PosBillForm.tsx",
  "app/admin/factory/add-work/page.tsx",
  "app/admin/orders/page.tsx",
  "app/admin/stock/page.tsx",
  "app/admin/factory/workers/page.tsx",
  "app/admin/factory/salary/page.tsx",
  "app/admin/dues/page.tsx",
  "app/admin/payments/page.tsx",
  "app/admin/customers/page.tsx",
  "app/admin/purchasing/page.tsx",
  "app/admin/operations/page.tsx",
  "app/admin/factory/ledger/page.tsx",
  "app/admin/reports/page.tsx",
  "app/admin/reports/channels/page.tsx",
  "app/admin/reports/channels/CampaignLinkMaker.tsx",
  "app/admin/alerts/page.tsx",
  // The menu, which is on every admin screen at once.
  "app/admin/nav-links.ts",
  "app/admin/AdminNav.tsx",
  "app/admin/AdminMobileNav.tsx",
  "app/admin/components/AdminDrawer.tsx",
  "app/admin/WorkspaceSwitch.tsx",
];

describe("the English side is English", () => {
  const files = ["app", "components", "lib"].flatMap(sourceFiles);

  it("has nothing leaking from a file nobody recorded", () => {
    const surprises = files
      .filter((file) => !(file in STILL_OWED) && !(file in BILINGUAL_ON_PURPOSE))
      .map((file) => [file, leakCount(file)] as const)
      .filter(([, count]) => count > 0)
      .map(([file, count]) => `${count}  ${file}`);

    expect(
      surprises,
      "Nepali with no English half, in files that were clean:\n" +
        `${surprises.join("\n")}\n` +
        "Write the pair, or a reader who pressed ENGLISH cannot read this screen.",
    ).toEqual([]);
  });

  it("never lets a listed file get worse", () => {
    const worse = Object.entries(STILL_OWED)
      .map(([file, owed]) => [file, owed, leakCount(file)] as const)
      .filter(([, owed, now]) => now > owed)
      .map(([file, owed, now]) => `${file}: was ${owed}, now ${now}`);

    expect(worse, `These went backwards:\n${worse.join("\n")}`).toEqual([]);
  });

  it("keeps the list honest — a finished file comes off it", () => {
    const finished = Object.keys(STILL_OWED).filter((file) => {
      try {
        return leakCount(file) === 0;
      } catch {
        return true; // a deleted file comes off the list too
      }
    });

    expect(
      finished,
      `Finished — delete these lines from STILL_OWED:\n${finished.join("\n")}`,
    ).toEqual([]);
  });

  it("holds the deliberately-bilingual places to what they were given", () => {
    const grown = Object.entries(BILINGUAL_ON_PURPOSE)
      .map(([file, { lines }]) => [file, lines, leakCount(file)] as const)
      .filter(([, allowed, now]) => now > allowed)
      .map(([file, allowed, now]) => `${file}: allowed ${allowed}, found ${now}`);

    expect(
      grown,
      "An exemption covers the lines it was written for, not the file:\n" + grown.join("\n"),
    ).toEqual([]);
  });

  it("gives every exemption a reason", () => {
    for (const [file, { why }] of Object.entries(BILINGUAL_ON_PURPOSE)) {
      expect(why.length, file).toBeGreaterThan(40);
    }
  });

  it.each(DAILY)("%s stays at zero", (file) => {
    expect(leakCount(file)).toBe(0);
  });
});
