import { describe, expect, it } from "vitest";
import { reviewUrl } from "@/lib/admin-settings";

/**
 * The owner's public review links are shown to shoppers as clickable buttons
 * after a happy rating. So whatever the owner (or anyone who reaches the settings
 * form) types has to be safe to hand a shopper's browser. reviewUrl is the guard:
 * it keeps http(s) links and drops everything else to empty — an empty link is
 * simply not offered. This pins that, so a later edit cannot let a javascript:
 * URL or other hostile value reach a click.
 */
describe("the review-link guard", () => {
  it("keeps real http and https links", () => {
    expect(reviewUrl("https://g.page/r/krishoe")).toBe("https://g.page/r/krishoe");
    expect(reviewUrl("http://facebook.com/krishoe/reviews")).toBe(
      "http://facebook.com/krishoe/reviews",
    );
  });

  it("drops anything that is not an http(s) URL to empty", () => {
    // A javascript: URL is the one that matters — it would run on click.
    expect(reviewUrl("javascript:alert(1)")).toBe("");
    expect(reviewUrl("ftp://example.com")).toBe("");
    expect(reviewUrl("data:text/html,<script>")).toBe("");
    expect(reviewUrl("not a url at all")).toBe("");
  });

  it("treats blank as 'not offered', never a broken link", () => {
    expect(reviewUrl("")).toBe("");
    expect(reviewUrl("   ")).toBe("");
    expect(reviewUrl(undefined)).toBe("");
  });

  it("caps length so a pasted essay cannot bloat the row", () => {
    const long = "https://example.com/" + "a".repeat(1000);
    expect(reviewUrl(long).length).toBeLessThanOrEqual(400);
  });
});
