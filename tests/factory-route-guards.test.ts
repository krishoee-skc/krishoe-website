import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory()
      ? routeFiles(fullPath)
      : entry.name === "route.ts"
        ? [fullPath]
        : [];
  });
}

describe("Factory route-handler defense in depth", () => {
  it("authorizes every exported HTTP handler before its broad try/catch", () => {
    const root = path.join(process.cwd(), "app", "api", "factory");

    for (const file of routeFiles(root)) {
      const source = readFileSync(file, "utf8");
      const handlers = [...source.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)\b/g)];
      const authorizationCalls = [...source.matchAll(/await authorizeFactoryApi\(/g)];

      expect(authorizationCalls.length, path.relative(process.cwd(), file)).toBe(handlers.length);

      handlers.forEach((handler, index) => {
        const sectionStart = handler.index ?? 0;
        const sectionEnd = handlers[index + 1]?.index ?? source.length;
        const section = source.slice(sectionStart, sectionEnd);
        const authorizationIndex = section.indexOf("await authorizeFactoryApi(");
        const tryIndex = section.indexOf("try {");

        expect(authorizationIndex, `${path.relative(process.cwd(), file)} ${handler[1]}`).toBeGreaterThan(-1);
        expect(tryIndex, `${path.relative(process.cwd(), file)} ${handler[1]}`).toBeGreaterThan(-1);
        expect(authorizationIndex, `${path.relative(process.cwd(), file)} ${handler[1]}`).toBeLessThan(tryIndex);
      });
    }
  });
});
