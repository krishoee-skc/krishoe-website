import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const page = readFileSync(path.join(process.cwd(), "app/admin/security/page.tsx"), "utf8");

describe("CCTV platform links", () => {
  it("provides direct iPhone and Android store links for verified apps", () => {
    expect(page).toContain("apps.apple.com/in/app/hik-connect/id1087803190");
    expect(page).toContain("play.google.com/store/apps/details?id=com.connect.enduser");
    expect(page).toContain("apps.apple.com/in/app/v380-pro/id1388988209");
    expect(page).toContain("play.google.com/store/apps/details?id=com.macrovideo.v380pro");
  });

  it("provides desktop choices and does not guess an EOQDZI app", () => {
    expect(page).toContain("ivms4200-series");
    expect(page).toContain("v380-for-pc");
    expect(page).toContain("required app could not be verified");
    expect(page).not.toContain("store/search?q=EOQDZI");
  });
});
