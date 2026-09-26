import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Adding a member on Factory → Workers.
 *
 * The owner added "ganga gurung" as monthly staff and found the stage still
 * on Upper (the form resets to piece rate and Upper after every save), the
 * salary box allowed to stay empty, and the same "Worker created and HR link
 * saved." after each person, which never said who.
 */
const FORM = "app/admin/factory/workers/TeamList.tsx";
const ROUTE = "app/api/factory/workers/route.ts";

describe("the add-member form", () => {
  it("moves the stage to Staff when Monthly staff is chosen, and back again", async () => {
    const form = await readFile(FORM, "utf8");

    expect(form).toContain("onChange={(event) => changeWorkerType(event.target.value)}");
    expect(form).toMatch(/workerType === "monthly_staff"[\s\S]*?category: "Staff"/);
    // Only a stage the form set by itself goes back to Upper.
    expect(form).toMatch(/stageAutoStaff && formData\.category === "Staff"[\s\S]*?category: "Upper"/);
    // Picking a stage by hand keeps it.
    expect(form).toMatch(/onChange=\{\(event\) => \{ setStageAutoStaff\(false\);/);
  });

  it("will not save monthly staff without a salary", async () => {
    const form = await readFile(FORM, "utf8");
    const create = form.slice(form.indexOf("async function createWorker"));

    const check = create.indexOf('formData.worker_type === "monthly_staff" && !(Number(formData.monthly_salary) > 0)');
    const post = create.indexOf('fetch("/api/factory/workers"');
    expect(check).toBeGreaterThan(0);
    expect(check, "asked before anything is sent").toBeLessThan(post);
    expect(form).toContain("मासिक तलब भर्नुहोस्");

    const route = await readFile(ROUTE, "utf8");
    expect(route).toMatch(/worker_type === "monthly_staff" && !monthly_salary/);
  });

  it("says who was added, by name", async () => {
    const form = await readFile(FORM, "utf8");

    expect(form).toContain("✅ ${addedName} थपियो");
    expect(form).not.toContain("Worker created and HR link saved.");
  });

  it("names the advance box for every kind of member", async () => {
    const form = await readFile(FORM, "utf8");

    expect(form).toContain('text("Usual expense / advance", "सामान्य खर्च / advance")');
  });
});
