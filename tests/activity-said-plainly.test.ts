import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { AdminAuditEvent } from "@/lib/admin-audit";
import { activityKind, activityLines, explainWarnings, isRoutine, linesByDay, sayEvent } from "@/lib/activity-view";

/**
 * The activity page, from the owner's own trail of 2026-09-30: bills and
 * goods among six evening jobs twice a night, "Counter Item Reviewed" four
 * times in a second, and "Login Failed" three times with no word of what it was.
 */
let n = 0;
function event(action: string, createdAt: string, detail = "", extra: Partial<AdminAuditEvent> = {}): AdminAuditEvent {
  n += 1;
  return {
    id: `KRS-AUD-${n}`,
    createdAt,
    action,
    detail,
    status: "success",
    actorId: "owner",
    actorName: "KRISHOE Owner",
    actorEmail: "skschhapal@gmail.com",
    actorRole: "Owner",
    actorBranchId: "branch-factory-main",
    ...extra,
  };
}

describe("a row said plainly", () => {
  it("says a bill, new goods, a count and a cheque in the shop's words", () => {
    expect(sayEvent(event("pos_create_invoice", "", "KRB002 sale invoice recorded for Rs. 2400.")).ne).toBe("KRB002 बिल · रु. 2,400");
    expect(
      sayEvent(event("counter_item_added", "", "close shoes indian #400 (KR-209) added from the wholesale counter: 6 pairs, Rs. 650")).ne,
    ).toBe("नयाँ माल: close shoes indian #400 · 6 जोडी");
    expect(sayEvent(event("stock_place_count", "", "kitto 770 counted at Shop: 120 pairs.")).ne).toBe("गन्ती: kitto 770 · पसल 120 जोडी");
    expect(
      sayEvent(event("pos_cheque_marked", "", "Cheque on KR-BILL-20260926-0004-17CC00 (Walk-in Customer, Rs. 10500) marked cleared by KRISHOE Owner.")).ne,
    ).toBe("चेक KR-BILL-20260926-0004-17CC00 · रु. 10,500 · साटियो");
  });

  it("sorts rows into the shop's kinds", () => {
    expect(activityKind("pos_create_invoice")).toBe("sale");
    expect(activityKind("counter_item_reviewed")).toBe("goods");
    expect(activityKind("login_mfa_challenge")).toBe("security");
    expect(activityKind("nightly_daily")).toBe("nightly");
    expect(activityKind("settings_database_cheques_ready")).toBe("settings");
  });

  it("leaves sign-in codes and order-list downloads out of the plain view, never a warning", () => {
    expect(isRoutine({ action: "login_mfa_challenge", status: "success" })).toBe(true);
    expect(isRoutine({ action: "order_export", status: "success" })).toBe(true);
    expect(isRoutine({ action: "login_success", status: "success" })).toBe(false);
    expect(isRoutine({ action: "order_export", status: "warning" })).toBe(false);
  });
});

describe("lines, not rows", () => {
  const night = ["daily", "daily-production", "review-requests", "idle-staff", "weekly-backup", "outside-check"].map((job) =>
    event(`nightly_${job}`, "2026-09-30T14:49:23.000Z", "Sent.", { actorName: "Nightly jobs", actorEmail: "", actorRole: "System" }),
  );
  const reviewed = [1, 2, 3, 4].map((second) => event("counter_item_reviewed", `2026-09-30T11:40:0${second}.000Z`, `Counter item CTR-${second} looked at`));
  const bill = event("pos_create_invoice", "2026-09-30T11:36:09.000Z", "KRB002 sale invoice recorded for Rs. 2400.");

  it("folds an evening's jobs into one line, and four marks into one", () => {
    const lines = activityLines([...night, ...reviewed, bill]);
    expect(lines.map((line) => line.said.ne)).toEqual([
      "रातिका 6 काम ठीक चले ✓",
      "नयाँ माल हेरेर ठीक भनियो ×4",
      "KRB002 बिल · रु. 2,400",
    ]);
  });

  it("says which evening jobs failed", () => {
    const failed = event("nightly_weekly-backup", "2026-09-30T14:49:24.000Z", "Failed: disk full", { status: "warning" });
    const [line] = activityLines([...night.slice(0, 2), failed]);
    expect(line.said.ne).toBe("रातिका काम: 3 मध्ये 1 असफल");
    expect(line.warning).toBe(true);
  });

  it("keeps each bill its own line, and groups by Kathmandu day", () => {
    const early = event("pos_create_invoice", "2026-09-29T18:30:00.000Z", "KRB001 sale invoice recorded for Rs. 3625.");
    const lines = activityLines([bill, early]);
    expect(lines).toHaveLength(2);
    // 18:30 UTC on the 29th is 00:15 on the 30th in Kathmandu.
    expect(linesByDay(lines).map((day) => day.day)).toEqual(["2026-09-30"]);
  });
});

describe("warnings with what they were", () => {
  it("calls a failed sign-in followed by one that worked a slip, and a wrong email a wrong email", () => {
    const failed = event("login_failed", "2026-09-28T20:47:42.000Z", "Invalid staff login attempt", { status: "warning" });
    const ok = event("login_success", "2026-09-28T20:49:26.000Z", "Staff KRISHOE Owner signed in");
    const typo = event("login_failed", "2026-09-28T15:05:40.000Z", "Invalid staff login attempt for skchhapal@gmail.com.", {
      status: "warning",
      actorEmail: "skchhapal@gmail.com",
      actorName: "skchhapal@gmail.com",
    });
    const okAfterTypo = event("login_success", "2026-09-28T15:07:57.000Z", "signed in");
    const [slip, wrongEmail] = explainWarnings([failed, typo], [failed, ok, typo, okAfterTypo]);
    expect(slip.worry).toBe(false);
    expect(slip.ne).toBe("Password गलत, अनि 2 मिनेटमा login ✓ — टाइप गल्ती जस्तो।");
    expect(wrongEmail.worry).toBe(false);
    expect(wrongEmail.ne).toContain('गलत email "skchhapal@gmail.com"');
  });

  it("worries about a refused sign-in nobody followed", () => {
    const failed = event("login_failed", "2026-09-28T20:47:42.000Z", "Invalid staff login attempt", { status: "warning" });
    expect(explainWarnings([failed], [failed])[0].worry).toBe(true);
  });

  it("does not worry over Google being busy", () => {
    const ai = event("product_ai_draft", "2026-09-26T18:14:44.000Z", 'AI draft for "Doctor Chappal" produced nothing: Google returned 503.', { status: "warning" });
    expect(explainWarnings([ai], [ai])[0].worry).toBe(false);
  });
});

describe("the page", () => {
  it("draws today's numbers, the explained warnings and the trail by day", async () => {
    const page = (await readFile("app/admin/activity/page.tsx", "utf8")).replace(/\r\n/g, "\n");
    expect(page).toContain("const days = linesByDay(activityLines(shown));");
    expect(page).toContain('<T en="What matters" ne="महत्त्वपूर्ण" />');
    expect(page).toContain("explainWarnings(");
    expect(page).not.toContain("<th className=\"py-2 pr-3\">Audit ID</th>");
  });
});
