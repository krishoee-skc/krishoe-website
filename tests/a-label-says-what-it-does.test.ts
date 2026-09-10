import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * A button that says one thing and does another.
 *
 * Five panels read "Correct a mistaken work entry", "Correct this handover",
 * and so on — and every one of them opened a form that reverses. The wage or
 * the receipt is taken back, not fixed.
 *
 * The owner found this the way owners do: they had just been given a Correct
 * button on the piece ledger, went looking for it on the worker page, and
 * found a form that would have undone the entry instead. The button inside
 * said "Reverse" and the checkbox said "I confirm this entry is incorrect" —
 * but the line read first is the one that decides whether it gets pressed.
 */
async function tsxFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await tsxFiles(full)));
    else if (entry.name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("a label that matches its action", () => {
  it("never says correct or edit over a form that reverses or deletes", async () => {
    const files = await tsxFiles("app");
    const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
    const offenders: string[] = [];

    files.forEach((file, index) => {
      const pattern = /<summary[^>]*>\s*([^<]{4,60}?)\s*<\/summary>\s*<form action=\{(\w+)\}/g;
      for (const match of sources[index].matchAll(pattern)) {
        const [, label, action] = match;
        const promisesAFix = /correct|edit|change|fix/i.test(label);
        const actuallyUndoes = /reverse|delete|cancel|remove/i.test(action);
        if (promisesAFix && actuallyUndoes) {
          offenders.push(`${file}: "${label.trim()}" opens ${action}`);
        }
      }
    });

    expect(
      offenders.join("\n"),
      "the label promises a correction and the form undoes the entry",
    ).toBe("");
  });

  it("says reverse on the worker page, where reversing is what happens", async () => {
    const page = await readFile(
      "app/admin/operations/production-accounts/worker/[id]/page.tsx",
      "utf8",
    );

    expect(page).toContain("Reverse this work entry");
    expect(page).toContain("Reverse this cash entry");
    expect(page).not.toContain("Correct a mistaken");
  });

  it("points at the screen where correcting is real", async () => {
    const page = await readFile(
      "app/admin/operations/production-accounts/worker/[id]/page.tsx",
      "utf8",
    );

    // Correcting a work entry does exist — on the piece ledger, where the
    // mistake is read. Saying only "reverse" would hide that.
    expect(page).toContain("/admin/factory/ledger");
    expect(page).toContain("colour, size, pairs or rate");
  });
});
