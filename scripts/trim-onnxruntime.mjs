/**
 * Drop the onnxruntime binaries this deployment cannot use.
 *
 * onnxruntime-node ships prebuilt binaries for every platform it supports —
 * 283 MB in total, of which Windows is 132 MB and macOS 84 MB. Vercel allows
 * 250 MB unzipped for one serverless function, so the background-removal route
 * cannot deploy while the package carries all three.
 *
 * next.config.js was the obvious place to fix this, and it does not work:
 * `serverExternalPackages` takes onnxruntime-node out of the bundler's hands,
 * and `outputFileTracingExcludes` then has nothing to exclude from — the whole
 * package directory is copied verbatim. Two different glob shapes were tried
 * and both left all thirteen binaries in the trace. So the removal has to
 * happen on disk, before the build reads the directory.
 *
 * Runs from the `build` script on Vercel only. Locally it exits untouched:
 * deleting the Windows binaries on the owner's Windows machine would break
 * `npm run dev` and the tests, and the failure would look like a broken model
 * rather than a missing file.
 *
 * Safe to run twice; already-gone directories are skipped.
 */
import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const BIN = path.join(process.cwd(), "node_modules", "onnxruntime-node", "bin", "napi-v6");

/**
 * Vercel's Linux runtime is x64. Everything else in the package is weight.
 *
 * Keyed by directory rather than by a glob so a rename upstream fails loudly
 * — an unknown layout keeps everything, which deploys slowly rather than
 * deleting something needed.
 */
const KEEP = { linux: ["x64"] };

async function sizeMb(dir) {
  let total = 0;
  const walk = async (current) => {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) await walk(full);
      else total += (await stat(full)).size;
    }
  };
  try {
    await walk(dir);
  } catch {
    return 0;
  }
  return Math.round(total / 1024 / 1024);
}

async function main() {
  // Vercel sets this. Without it we are on someone's own machine, where these
  // binaries are the ones actually in use.
  if (!process.env.VERCEL) {
    console.log("trim-onnxruntime: not on Vercel, leaving every binary in place.");
    return;
  }

  let platforms;
  try {
    platforms = await readdir(BIN, { withFileTypes: true });
  } catch {
    // The package is not installed, or its layout changed. Either way there is
    // nothing safe to do, and the build should carry on.
    console.log("trim-onnxruntime: no onnxruntime binaries found, nothing to do.");
    return;
  }

  const before = await sizeMb(BIN);
  const removed = [];

  for (const platform of platforms) {
    if (!platform.isDirectory()) continue;

    const keptArches = KEEP[platform.name];
    const platformDir = path.join(BIN, platform.name);

    // A platform we do not run at all: remove it whole.
    if (!keptArches) {
      const mb = await sizeMb(platformDir);
      await rm(platformDir, { recursive: true, force: true });
      removed.push(`${platform.name} (${mb} MB)`);
      continue;
    }

    // A platform we do run: keep only the architectures named above.
    for (const arch of await readdir(platformDir, { withFileTypes: true })) {
      if (!arch.isDirectory() || keptArches.includes(arch.name)) continue;
      const archDir = path.join(platformDir, arch.name);
      const mb = await sizeMb(archDir);
      await rm(archDir, { recursive: true, force: true });
      removed.push(`${platform.name}/${arch.name} (${mb} MB)`);
    }
  }

  const after = await sizeMb(BIN);

  if (!removed.length) {
    console.log(`trim-onnxruntime: nothing to remove, ${after} MB in place.`);
    return;
  }

  console.log(`trim-onnxruntime: removed ${removed.join(", ")}.`);
  console.log(`trim-onnxruntime: ${before} MB down to ${after} MB.`);

  // The one thing that must survive. If it did not, say so loudly — a build
  // that succeeds without it fails later, at runtime, on a customer's photo.
  const linuxX64 = path.join(BIN, "linux", "x64");
  try {
    await stat(linuxX64);
  } catch {
    throw new Error(
      "trim-onnxruntime: the Linux x64 binary is gone. Background removal would fail at runtime.",
    );
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
