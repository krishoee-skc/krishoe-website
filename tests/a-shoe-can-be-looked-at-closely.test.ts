import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * Seeing the shoe before buying it.
 *
 * The product page shows one photo in a square, cropped with object-cover. The
 * shop's real photographs are all wider than they are tall — 893x723, 1536x1024
 * and 3840x2160 — so the square was cutting 19%, 33% and 44% off them. A
 * customer deciding on a pair was being shown a little over half of the widest
 * shoe, with no way to see the rest.
 *
 * There was no zoom at all. A shoe is bought on its stitching, its sole and the
 * exact shade of its colour, and none of that survives a thumbnail on a phone.
 *
 * So the photo opens full-screen, drawn with object-contain — the whole shoe,
 * including the parts the square cut — and tapping it magnifies around the
 * point tapped, so the sole can be brought close rather than the middle of the
 * picture.
 */
const GALLERY = "components/ProductGallery.tsx";

describe("opening the photo", () => {
  it("is a real control, not a picture that happens to be clickable", async () => {
    const source = await readFile(GALLERY, "utf8");

    // A screen reader has to be told this opens something, and a keyboard has
    // to be able to reach it.
    expect(source).toContain("onClick={openZoom}");
    expect(source).toContain("aria-label={text(`See ${name} larger`");
  });

  it("says so on the photo, because a tappable image is not obvious", async () => {
    const source = await readFile(GALLERY, "utf8");

    expect(source).toContain("Tap to enlarge");
    expect(source).toContain("ठूलो पार्न थिच्नुहोस्");
  });

  it("uses a native dialog, so Escape closes it and focus stays inside", async () => {
    const source = await readFile(GALLERY, "utf8");

    expect(source).toContain("showModal()");
    expect(source).toContain("<dialog");
  });

  it("closes when the backdrop is tapped", async () => {
    const source = await readFile(GALLERY, "utf8");

    expect(source).toContain("if (event.target === dialogRef.current) closeZoom();");
  });

  it("stops the page scrolling underneath on a phone", async () => {
    const source = await readFile(GALLERY, "utf8");

    // Otherwise the photo slides away under the finger.
    expect(source).toContain(`document.body.style.overflow = "hidden"`);
  });
});

describe("what the big view shows", () => {
  it("fits the whole shoe, rather than cropping it again", async () => {
    const source = await readFile(GALLERY, "utf8");

    // Pinned to the big image itself, not merely to the dialog: the small
    // thumbnails inside the dialog use object-cover quite correctly, so
    // searching the whole dialog for "object-contain" passed even with the
    // main photo switched back to cover — which is exactly the regression this
    // test exists to catch, and it was checked by making that switch.
    expect(source).toContain('className="object-contain transition-transform');
    expect(source).not.toContain('className="object-cover transition-transform');
  });

  it("asks for a better image than the page thumbnail", async () => {
    const source = await readFile(GALLERY, "utf8");

    expect(source).toContain("quality={90}");
    expect(source).toContain(`sizes="100vw"`);
  });
});

describe("looking closer", () => {
  it("magnifies around the point that was tapped", async () => {
    const source = await readFile(GALLERY, "utf8");

    // Growing from the centre would send a tap on the sole off-screen.
    expect(source).toContain("transformOrigin: `${origin.x}% ${origin.y}%`");
    expect(source).toContain("scale(2.5)");
  });

  it("can be worked from a keyboard as well as a finger", async () => {
    const source = await readFile(GALLERY, "utf8");

    expect(source).toContain("tabIndex={0}");
    expect(source).toContain(`event.key !== "Enter" && event.key !== " "`);
  });

  it("starts every photo whole, never part-way into a corner", async () => {
    const source = await readFile(GALLERY, "utf8");
    const start = source.indexOf("function showImage");
    const end = source.indexOf("<div className=\"flex flex-col gap-4\">", start);
    const reset = source.slice(start, end);

    // Both ends asserted, so a moved boundary cannot quietly return the whole
    // file or nothing at all.
    expect(start, "showImage is missing").toBeGreaterThan(-1);
    expect(end, "no end found after showImage").toBeGreaterThan(start);
    expect(reset).toContain("setMagnified(false)");
    expect(reset).toContain("setOrigin({ x: 50, y: 50 })");
  });

  it("is reset when the view is closed, so it reopens whole", async () => {
    const source = await readFile(GALLERY, "utf8");
    const onClose = source.slice(source.indexOf("onClose={"), source.indexOf("onClick={(event)"));

    expect(onClose).toContain("setMagnified(false)");
  });

  it("tells the reader what a tap will do, and what it did", async () => {
    const source = await readFile(GALLERY, "utf8");

    expect(source).toContain("Tap the photo to look closer");
    expect(source).toContain("Tap again to fit the whole shoe");
  });
});
