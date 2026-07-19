import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";

// What makes the site installable on a phone rather than merely bookmarkable.
// It shipped for months with only favicon.ico listed, so Android never offered
// "Install app" and there was no KRISHOE to put on the home screen — a missing
// icon file is not the kind of thing that shows up as a broken page.

const app = manifest();

function iconFile(src: string) {
  return path.join(process.cwd(), "public", src.replace(/^\//, ""));
}

describe("the manifest meets the install requirements", () => {
  it("opens without the browser chrome", () => {
    expect(app.display).toBe("standalone");
  });

  it("has a name, a short name and a start url", () => {
    expect(app.name).toBeTruthy();
    expect(app.short_name).toBeTruthy();
    expect((app.short_name ?? "").length).toBeLessThanOrEqual(12);
    expect(app.start_url).toBe("/");
  });

  // The two Android actually checks for.
  for (const size of ["192x192", "512x512"]) {
    it(`declares a ${size} png`, () => {
      const icon = (app.icons ?? []).find(
        (item) => item.sizes === size && item.type === "image/png",
      );

      expect(icon, `no ${size} png in the manifest`).toBeDefined();
    });
  }

  it("declares a maskable icon so the mark is not cropped into", () => {
    expect((app.icons ?? []).some((icon) => icon.purpose === "maskable")).toBe(true);
  });
});

describe("every icon the manifest promises exists", () => {
  for (const icon of manifest().icons ?? []) {
    const src = icon.src;

    // favicon.ico is served by Next from app/, not from public/.
    if (src === "/favicon.ico") {
      it("ships a favicon", () => {
        expect(existsSync(path.join(process.cwd(), "app", "favicon.ico"))).toBe(true);
      });
      continue;
    }

    it(`ships ${src}`, () => {
      const file = iconFile(src);

      expect(existsSync(file), `${src} is in the manifest but not on disk`).toBe(true);
      // A zero-byte or placeholder file passes an existence check and still
      // fails to install.
      expect(statSync(file).size).toBeGreaterThan(1000);
    });
  }

  it("ships the apple touch icon for iOS home screens", () => {
    const file = path.join(process.cwd(), "app", "apple-icon.png");

    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeGreaterThan(1000);
  });
});
