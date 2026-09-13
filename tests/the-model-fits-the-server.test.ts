import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Making the background-removal function small enough to deploy.
 *
 * onnxruntime-node ships prebuilt binaries for every platform: 283 MB, of
 * which Windows is 132 and macOS 84. Vercel allows 250 MB unzipped for one
 * serverless function, so the route could not deploy while the package carried
 * all three.
 *
 * next.config.js was tried first and does not work. `serverExternalPackages`
 * takes the package out of the bundler's hands and `outputFileTracingExcludes`
 * then has nothing to exclude from — the directory is copied whole. Two glob
 * shapes were tried; both left all thirteen binaries in the trace, which was
 * confirmed by reading the .nft.json after a build rather than by assuming the
 * config had worked.
 *
 * So the binaries are deleted on disk before the build reads the directory,
 * from a prebuild step. Measured on a copy of the real package with VERCEL=1:
 * 283 MB down to 43 MB, leaving linux/x64 alone.
 *
 * The dangerous version of this script is one that runs everywhere. Deleting
 * the Windows binaries on the owner's Windows machine would break `npm run
 * dev` and every test that touches the model, and the failure would read as a
 * broken model rather than a missing file. So it exits untouched unless
 * VERCEL is set — verified by running it here, where nothing was removed.
 */
const SCRIPT = "scripts/trim-onnxruntime.mjs";

describe("the trim that makes the function deployable", () => {
  it("runs before the build, not after", async () => {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));

    // npm runs `prebuild` ahead of `build` on its own. After the build it
    // would be measuring a directory the build has already read.
    expect(pkg.scripts.prebuild).toBe("node scripts/trim-onnxruntime.mjs");
  });

  it("does nothing at all off Vercel", async () => {
    const source = await readFile(SCRIPT, "utf8");

    // The whole safety of this rests on one condition. Without it the script
    // deletes the binaries the owner's own machine is running on.
    expect(source).toContain("if (!process.env.VERCEL)");
    expect(source).toContain("leaving every binary in place");
  });

  it("keeps the one binary the server actually runs", async () => {
    const source = await readFile(SCRIPT, "utf8");

    expect(source).toContain('KEEP = { linux: ["x64"] }');
  });

  it("names what it keeps rather than globbing what it deletes", async () => {
    const source = await readFile(SCRIPT, "utf8");

    // A glob of what to remove treats an unknown directory as removable. A
    // list of what to keep treats it as keepable — which deploys slowly if
    // upstream renames something, instead of deleting what the route needs.
    expect(source).toContain("if (!keptArches)");
    expect(source).toContain("keptArches.includes(arch.name)");
  });

  it("fails the build if it removed the binary it was protecting", async () => {
    const source = await readFile(SCRIPT, "utf8");

    // A build that succeeds without it fails later, at runtime, on a
    // customer's photo — the worst place to find out.
    expect(source).toContain("the Linux x64 binary is gone");
    expect(source).toContain("process.exit(1)");
  });

  it("survives a second run and a missing package", async () => {
    const source = await readFile(SCRIPT, "utf8");

    expect(source).toContain("force: true");
    expect(source).toContain("no onnxruntime binaries found");
  });
});
