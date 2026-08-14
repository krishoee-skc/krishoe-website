import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * The portal reads the factory tables, not the HR module. When a sign-in has no
 * worker behind it, the screen has to send the reader to the link that actually
 * exists — Settings → staff account → Factory worker. It used to say "HR setup
 * required" and ask for an HR employee record, which is a door that no longer
 * opens onto anything.
 */
describe("worker portal unavailable screen", () => {
  it("points at the factory worker link, not HR", async () => {
    const source = await readFile("components/worker/WorkerPortalUnavailable.tsx", "utf8");

    expect(source).toContain("Factory worker");
    expect(source).toContain("Settings");
    expect(source).not.toContain("HR employee record");
    expect(source).not.toContain("HR setup required");
  });

  it("explains itself in Nepali", async () => {
    const source = await readFile("components/worker/WorkerPortalUnavailable.tsx", "utf8");
    expect(source).toContain("कामदार जोडिएको छैन");
  });

  it("gives the unlinked reasons in Nepali too", async () => {
    const source = await readFile("lib/worker-auth.ts", "utf8");
    expect(source).toContain("कारखानाको कामदारसँग जोडिएको छैन");
    expect(source).toContain("निष्क्रिय छ");
  });
});
