import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * A customer's note about the app itself reaches somebody.
 *
 * The shop has two ways to be told something and only one of them worked.
 * Reviews, questions and complaints go to `customer_voice` and the owner reads
 * them at /admin/inbox. A note about the app — a button that does not work, a
 * figure that reads wrong — went to a `user_feedback` table read by one screen
 * that no route ever rendered. Customers could send it; nobody could open it.
 *
 * On the database built from docs/schema.sql that table does not exist at all,
 * because it is created by a file outside `scripts/migrations` that the schema
 * runner never reads. So the form at /feedback accepted what a customer typed
 * and then failed on the insert — a form that looks like it works and does not
 * is worse than no form.
 *
 * It is now the fourth kind in the inbox that already works. These check the
 * three things that makes true: the kind is allowed everywhere it has to be,
 * the write goes to the inbox, and a note about a button can never appear on a
 * shoe's page.
 */

describe("the app kind", () => {
  it("is one of the kinds the inbox knows", async () => {
    const lib = await readFile("lib/customer-voice.ts", "utf8");

    expect(lib, "the type must allow it").toMatch(
      /VoiceKind = "review" \| "question" \| "complaint" \| "app"/,
    );
    // The runtime list is what guards a stored row, and a type alone does not
    // check anything at runtime.
    expect(lib, "the runtime list must allow it").toMatch(
      /voiceKinds: VoiceKind\[\] = \["review", "question", "complaint", "app"\]/,
    );
  });

  it("is allowed by the database, in the snapshot and in a migration", async () => {
    const [schema, migration] = await Promise.all([
      readFile("docs/schema.sql", "utf8"),
      readFile("scripts/migrations/20260923_customer_voice_app_kind.sql", "utf8"),
    ]);

    // Both, because the snapshot builds a new database and the migration
    // updates the one that is already running. Either one alone leaves half
    // the world unable to store it.
    expect(schema, "a rebuilt database must accept it").toMatch(
      /kind IN \('review', 'question', 'complaint', 'app'\)/,
    );
    expect(migration, "the live database must be widened too").toMatch(
      /kind IN \('review', 'question', 'complaint', 'app'\)/,
    );
    expect(migration, "the old constraint has to go first").toContain(
      "DROP CONSTRAINT IF EXISTS customer_voice_kind_check",
    );
  });

  it("has a chip in the inbox, so it can be read", async () => {
    const inbox = await readFile("app/admin/inbox/page.tsx", "utf8");

    // A kind the database accepts and the screen never lists is the same fault
    // in a new place: arriving somewhere nobody looks.
    expect(inbox, "the inbox must list it").toMatch(/id: "app"/);
  });
});

describe("the feedback form", () => {
  it("writes to the inbox, not to the table that does not exist", async () => {
    const feedback = await readFile("lib/feedback.ts", "utf8");
    const submit = feedback.slice(
      feedback.indexOf("export async function submitFeedback"),
      feedback.indexOf("export async function getFeedbackStats"),
    );

    expect(submit, "it must save through customer voice").toMatch(/saveCustomerVoice\(/);
    expect(submit, "as the app kind").toMatch(/kind: "app"/);
    expect(submit, "the dead table must not be written to again").not.toMatch(
      /INSERT INTO user_feedback/,
    );
  });

  it("keeps the title, which is what the person led with", async () => {
    const feedback = await readFile("lib/feedback.ts", "utf8");

    // customer_voice carries one body of text. Dropping the title would throw
    // away the line the customer wrote first.
    expect(feedback, "the title is folded into the message").toMatch(
      /feedback\.title\.trim\(\)\s*\n?\s*\?\s*`\$\{feedback\.title\.trim\(\)\}/,
    );
  });

  it("keeps which of the four kinds of note it was", async () => {
    const feedback = await readFile("lib/feedback.ts", "utf8");

    // A bug report and a feature request read differently, and the owner
    // should be able to tell them apart in the row.
    expect(feedback, "the type is kept in source").toMatch(/source: `app-\$\{feedback\.type\}`/);
  });

  it("carries a rating only when the note is a rating", async () => {
    const feedback = await readFile("lib/feedback.ts", "utf8");

    // A bug report has no verdict, and 0 is what the column means by "none".
    expect(feedback).toMatch(/feedback\.type === "rating" \? \(feedback\.rating \?\? 0\) : 0/);
  });

  it("does not lose the note when the notification fails", async () => {
    const feedback = await readFile("lib/feedback.ts", "utf8");
    const submit = feedback.slice(
      feedback.indexOf("export async function submitFeedback"),
      feedback.indexOf("export async function getFeedbackStats"),
    );

    // The row is saved first and the notification cannot undo it: an email
    // that fails must not cost the shop a customer's note.
    expect(submit.indexOf("saveCustomerVoice("), "saved before notifying").toBeLessThan(
      submit.indexOf("notifyAdminFeedback("),
    );
    expect(submit, "a failed notification is caught").toMatch(
      /try \{\s*await notifyAdminFeedback[\s\S]*?\} catch/,
    );
  });
});

describe("a note about the app", () => {
  it("never reaches a shoe's page", async () => {
    const lib = await readFile("lib/customer-voice.ts", "utf8");

    // The storefront reads published reviews for one product. An app note is
    // not a review, and this is the query that decides.
    expect(lib, "the storefront asks for reviews only").toMatch(
      /kind = 'review' AND published = true/,
    );
  });

  it("starts unpublished, like everything else that arrives", async () => {
    const lib = await readFile("lib/customer-voice.ts", "utf8");
    const created = lib.slice(lib.indexOf("function newCustomerVoice"), lib.indexOf("function duplicateReviewError"));

    expect(created, "nothing is public until the owner says so").toMatch(/published: false/);
    expect(created, "and it arrives waiting to be read").toMatch(/status: "new"/);
  });
});
