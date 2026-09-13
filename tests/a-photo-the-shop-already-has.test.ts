import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Taking the background off a photo that is already uploaded.
 *
 * The cut-out was first offered only in the product form. The screen where the
 * shop's photos actually get taken is Add photos — a shoe in one hand, a phone
 * in the other — and by the time the owner wants the background gone the photo
 * is already on the shop. Making them find the original on their phone again
 * would be the long way round from the screen they are standing on.
 *
 * So that screen sends a URL instead of a file. That turns this route into one
 * that fetches an address somebody else supplied, which is the shape of a
 * server-side request forgery: unchecked, anyone who reached the route could
 * point the server at an address only the server can see — a cloud metadata
 * endpoint, an internal service, an admin page on the private network — and
 * read back whatever it found.
 *
 * The guard parses the URL and compares the hostname as a whole against the
 * shop's own blob host. Not a substring test: "vercel-storage.com.attacker.net"
 * contains that name and is not that host.
 */
const ROUTE = "app/api/admin/remove-background/route.ts";
const CARD = "app/admin/products/photos/PhotoCard.tsx";

/**
 * The guard, mirrored from the route.
 *
 * The route is TypeScript, so its text cannot be evaluated here — the type
 * annotations are a syntax error to plain JS, which is how the first version of
 * this test failed. The logic is copied instead, and `guardMatchesRoute` below
 * asserts every condition it relies on is still in the route, so this copy
 * cannot quietly drift from what actually runs.
 */
function safeShopPhotoUrl(value: string): URL | null {
  let parsed: URL;

  try {
    parsed = new URL(value);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;

  const host = parsed.hostname.toLowerCase();
  if (!host.endsWith(".public.blob.vercel-storage.com")) return null;
  if (host === ".public.blob.vercel-storage.com") return null;
  if (parsed.username || parsed.password || parsed.port) return null;

  return parsed;
}

describe("the guard on a supplied URL", () => {
  it("still matches the route it was copied from", async () => {
    const source = await readFile(ROUTE, "utf8");
    const body = source.slice(
      source.indexOf("function safeShopPhotoUrl"),
      source.indexOf("\n}", source.indexOf("return parsed;")),
    );

    expect(body.length, "the guard moved or was removed").toBeGreaterThan(0);

    for (const condition of [
      'parsed.protocol !== "https:"',
      'host.endsWith(".public.blob.vercel-storage.com")',
      'host === ".public.blob.vercel-storage.com"',
      "parsed.username || parsed.password || parsed.port",
    ]) {
      expect(body, condition).toContain(condition);
    }
  });

  it("accepts the shop's own blob photos", () => {
    expect(safeShopPhotoUrl("https://abc123.public.blob.vercel-storage.com/products/x.webp")).not.toBeNull();
  });

  it("refuses every address that is not one", () => {
    for (const attack of [
      // The AWS metadata endpoint — the classic SSRF target.
      "https://169.254.169.254/latest/meta-data/",
      "http://localhost:3000/admin",
      "https://10.0.0.1/internal",
      // Carries the real host's name without being it.
      "https://vercel-storage.com.attacker.net/x",
      "https://evil.com/?x=.public.blob.vercel-storage.com",
      // Plain HTTP, a port, credentials, another scheme, an empty store name.
      "http://abc.public.blob.vercel-storage.com/x.webp",
      "https://abc.public.blob.vercel-storage.com:8080/x",
      "https://u:p@abc.public.blob.vercel-storage.com/x",
      "file:///etc/passwd",
      "https://.public.blob.vercel-storage.com/x",
      "not a url at all",
    ]) {
      expect(safeShopPhotoUrl(attack), attack).toBeNull();
    }
  });

  it("checks what came back, not only where it came from", async () => {
    const route = await readFile(ROUTE, "utf8");

    // A URL on the right host can still answer with something that is not a
    // photo, or with more bytes than the model should be handed.
    expect(route).toContain('fetched.headers.get("content-type")');
    expect(route).toContain("bytes.length > MAX_BYTES");
  });

  it("still takes a file too, for the product form", async () => {
    const route = await readFile(ROUTE, "utf8");

    expect(route).toContain("file instanceof File");
    expect(route).toContain("file.size > MAX_BYTES");
  });
});

describe("the cut-out on the Add photos screen", () => {
  it("is offered there, where the photos are taken", async () => {
    const card = await readFile(CARD, "utf8");

    expect(card).toContain("/api/admin/remove-background");
    expect(card).toContain("पृष्ठभूमि हटाउने");
  });

  it("shows the result and saves nothing until the owner keeps it", async () => {
    const card = await readFile(CARD, "utf8");

    // The model keeps the hand when a shoe is held. That is a judgement, not
    // something to write over the shopkeeper's photo unasked.
    expect(card).toContain("Keep this one");
    expect(card).toContain("Discard");
    expect(card).toContain("setCutout(null)");
  });

  it("warns when it barely changed the picture", async () => {
    const card = await readFile(CARD, "utf8");

    expect(card).toContain("cutout.keptPercent > 60");
  });

  it("is not offered where there is no real photo yet", async () => {
    const card = await readFile(CARD, "utf8");

    // A card still showing a bundled sample has no shoe to lift out of it.
    expect(card).toContain("product.hasRealPhoto && previewable");
  });

  it("saves through the same action an upload uses", async () => {
    const card = await readFile(CARD, "utf8");

    // Not a second path to writing a product's photo — the one that already
    // carries the permission check and the audit line.
    expect(card).toContain("saveProductPhotoAction");
  });
});
