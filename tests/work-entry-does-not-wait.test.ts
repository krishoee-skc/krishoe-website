import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The work-entry screen is opened fifty times a morning, and each of those is
 * a person standing at a workbench. These are the properties that keep the next
 * row typeable while the last one is still being saved — easy to undo by
 * accident, and each one costs the entry clerk real time.
 */
const FORM = "app/admin/factory/add-work/WorkEntryForm.tsx";

describe("entering the next row without waiting", () => {
  it("clears the pairs box before the save comes back", async () => {
    const source = await readFile(FORM, "utf8");

    // The clearing happens before the fetch, not in its .then — that is the
    // whole point. If these ever swap order the wait comes back.
    const clearAt = source.indexOf('pairs_count: "",\n      reject_pairs: "",');
    const fetchAt = source.indexOf('await fetch("/api/factory/work"');

    expect(clearAt, "the form should clear on submit").toBeGreaterThan(0);
    expect(fetchAt).toBeGreaterThan(0);
    expect(clearAt, "clear the form before sending, not after").toBeLessThan(fetchAt);
  });

  it("keeps the worker, the item and the stage for the next row", async () => {
    const source = await readFile(FORM, "utf8");

    // A person makes three or four rows of the same work. Re-picking the worker
    // and item each time was most of the typing.
    const submit = source.slice(source.indexOf("const handleSubmit"));
    const reset = submit.slice(
      submit.indexOf("setFormData((current) => ({"),
      submit.indexOf('await fetch("/api/factory/work"'),
    );

    expect(reset).toContain("...current");
    expect(reset).not.toContain("worker_id:");
    expect(reset).not.toContain("item_id:");
  });

  it("does not send the clerk away after saving", async () => {
    const source = await readFile(FORM, "utf8");

    // It used to redirect to the dashboard a second and a half after a save,
    // so a second entry meant navigating back. The only remaining push is the
    // Cancel button, which is a button the person chose to press.
    const pushes = source.match(/router\.push\("\/admin\/factory"\)/g) ?? [];
    expect(pushes).toHaveLength(1);
    expect(source).not.toContain("setTimeout(() => {\n        router.push");
  });

  it("puts a failed entry back in the form", async () => {
    const source = await readFile(FORM, "utf8");
    const failure = source.slice(source.indexOf("} catch (err) {"));

    // A wage entry that vanishes because the network blinked is a day's work
    // the factory has to remember by hand.
    expect(failure).toContain("setFormData(entry)");
    expect(failure).toContain('"error"');
  });

  it("gives every send its own idempotency key", async () => {
    const source = await readFile(FORM, "utf8");

    // Two entries a second apart — same worker, same item, same twenty pairs,
    // which is a real morning — share a key scope. Rotating before the request
    // rather than after the reply means the second is not mistaken for a repeat
    // of the first and dropped.
    const takeAt = source.indexOf("idempotencyKeys.get(keyScope)");
    const rotateAt = source.indexOf("idempotencyKeys.rotate(keyScope)");
    const fetchAt = source.indexOf('await fetch("/api/factory/work"');

    expect(takeAt).toBeGreaterThan(0);
    expect(rotateAt).toBeGreaterThan(takeAt);
    expect(rotateAt, "rotate before sending, not after the reply").toBeLessThan(fetchAt);
  });

  it("confirms with a toast that names the worker and the pairs", async () => {
    const source = await readFile(FORM, "utf8");

    // The form has already cleared, so the confirmation has to carry enough to
    // recognise: "Saved — 20 pairs for Ram", not "Saved".
    expect(source).toContain("toast.show(");
    expect(source).toContain("pairs for");
  });
});
