import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { THEME_STORAGE_KEY, themeBootScript } from "@/lib/theme-boot";

const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

/**
 * The admin sign-in page threw React #418 on about one load in four (2026-10-25).
 * The root layout took the theme boot script's text from ThemeToggle, a client
 * module, so the page carried a reference to it instead of the text; <head>
 * waited for that module's chunks, and when they were late React reached <body>
 * with its place still in <head>. The text must come from a plain module.
 */
describe("the theme boot script is inlined as text", () => {
  it("comes from a module that is not a client module", async () => {
    expect(await read("lib/theme-boot.ts")).not.toMatch(/^\s*["']use client["']/);
    expect(await read("app/layout.tsx")).toContain('import { themeBootScript } from "@/lib/theme-boot";');
    expect(await read("components/ThemeToggle.tsx")).not.toContain("export const themeBootScript");
  });

  it("still reads the stored choice, then the phone's setting", () => {
    expect(themeBootScript).toContain(`localStorage.getItem("${THEME_STORAGE_KEY}")`);
    expect(themeBootScript).toContain("prefers-color-scheme: dark");
    expect(themeBootScript).toContain('classList.toggle("dark",d)');
  });
});
