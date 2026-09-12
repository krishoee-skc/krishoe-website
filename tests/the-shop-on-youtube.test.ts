import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

/**
 * YouTube: a place in the shop, kept empty until it is real.
 *
 * The owner asked for two things — the channel linked from the shop, and
 * videos shown on it. The second is easy. The first has a trap: there was no
 * KRISHOE channel when this was written.
 *
 * Facebook, Instagram and TikTok each carry a default address in the code
 * because those accounts exist and the owner posts from them. Giving YouTube
 * the same treatment would mean guessing a handle, and a guessed handle is
 * either a 404 in the footer or, worse, someone else's channel named in
 * `sameAs` — which is not a link, it is a claim to Google that the channel and
 * this shop are one business.
 *
 * So the slot is built and left empty. businessSocialProfiles() already drops
 * anything blank, so nothing renders and nothing is claimed until
 * NEXT_PUBLIC_YOUTUBE_URL is set, and then it appears everywhere at once with
 * no code change.
 *
 * The video component is the other half. An embedded iframe costs about a
 * megabyte before anyone presses play and sets advertising cookies on arrival,
 * neither of which is reasonable on phone data for something most visitors
 * scroll past. ShopVideo renders YouTube's own thumbnail and builds the iframe
 * on the first click, through youtube-nocookie.com.
 */
const SEO = "lib/seo.ts";
const FOOTER = "components/Footer.tsx";
const VIDEO = "components/ShopVideo.tsx";
const NEXT_CONFIG = "next.config.js";

describe("the YouTube slot", () => {
  it("exists, so a link can be added without touching code", async () => {
    const seo = await readFile(SEO, "utf8");

    expect(seo).toContain("NEXT_PUBLIC_YOUTUBE_URL");
    expect(seo).toContain('{ label: "YouTube", url: businessContact.youtube }');
  });

  it("stays empty rather than guessing a channel", async () => {
    const seo = await readFile(SEO, "utf8");
    const line = seo.slice(seo.indexOf("youtube: process.env"), seo.indexOf("youtube: process.env") + 120);

    // The other three carry a real default. This one must not: a wrong channel
    // in sameAs tells Google the shop is a business it is not.
    expect(line).toContain('?? ""');
    expect(line).not.toMatch(/\?\?\s*"https/);
  });

  it("disappears completely while it is empty", async () => {
    const seo = await readFile(SEO, "utf8");
    const profiles = seo.slice(seo.indexOf("export function businessSocialProfiles"));

    // Without this filter an empty YouTube would render a footer icon linking
    // to nothing, and feed an empty string to Google as a sameAs.
    expect(profiles).toContain("profile.url.trim()");
    expect(profiles).toContain("profile.url.length > 0");
  });

  it("has its mark ready in the footer for when it is filled in", async () => {
    const footer = await readFile(FOOTER, "utf8");

    // Without this the icon falls through to the generic map pin.
    expect(footer).toContain('key.includes("youtube")');
  });
});

describe("showing a video without loading YouTube", () => {
  it("shows a thumbnail first and builds the player on a click", async () => {
    const video = await readFile(VIDEO, "utf8");

    expect(video).toContain("i.ytimg.com");
    expect(video).toContain("setPlaying(true)");
    // The iframe must be conditional. Rendering it always is the whole cost
    // this component exists to avoid.
    expect(video).toContain("{playing ? (");
  });

  it("uses the no-cookie host, so scrolling past is not tracked", async () => {
    const video = await readFile(VIDEO, "utf8");

    expect(video).toContain("youtube-nocookie.com");
    expect(video).not.toContain("https://www.youtube.com/embed");
  });

  it("starts playing on the same click that loaded it", async () => {
    const video = await readFile(VIDEO, "utf8");

    // Otherwise the visitor presses play twice: once to swap the image for the
    // player, once on the player itself.
    expect(video).toContain("autoplay=1");
  });

  it("takes a video id, not a pasted URL", async () => {
    const video = await readFile(VIDEO, "utf8");

    // A share link carries tracking parameters and a channel link is not a
    // video; both break silently where an id is expected.
    expect(video).toContain("id: string");
    expect(video).toContain("if (!id.trim()) return null;");
  });

  it("is allowed to load that thumbnail at all", async () => {
    const config = await readFile(NEXT_CONFIG, "utf8");

    // next/image refuses any host not listed here, so without this the
    // thumbnail is a broken image and the video looks broken with it.
    expect(config).toContain('hostname: "i.ytimg.com"');
    expect(config).toContain('pathname: "/vi/**"');
  });
});
