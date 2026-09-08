import { describe, expect, it } from "vitest";
import { readSavedMessage, savedMessage } from "@/lib/saved-message";

/**
 * The "saved ✅" line after a form is submitted. It travels through the URL,
 * so both languages have to survive the trip and the page has to be able to
 * pick one — including for messages written before this existed.
 */
describe("a saved message", () => {
  it("carries both languages", () => {
    const packed = savedMessage("Raw material added ✅", "कच्चा पदार्थ थपियो ✅");

    expect(readSavedMessage(packed)).toEqual({
      en: "Raw material added ✅",
      ne: "कच्चा पदार्थ थपियो ✅",
    });
  });

  it("survives being put through a URL", () => {
    const packed = savedMessage("Stock saved ✅", "स्टक सुरक्षित भयो ✅");
    const round = decodeURIComponent(encodeURIComponent(packed));

    expect(readSavedMessage(round).ne).toBe("स्टक सुरक्षित भयो ✅");
  });

  it("shows a one-language message to both readers", () => {
    // Written before this change, or a message with no translation yet: better
    // to show it in one language than to show nothing.
    expect(readSavedMessage("कच्चा पदार्थ थपियो ✅")).toEqual({
      en: "कच्चा पदार्थ थपियो ✅",
      ne: "कच्चा पदार्थ थपियो ✅",
    });
  });

  it("falls back to the half that exists when one is empty", () => {
    expect(readSavedMessage(savedMessage("Saved ✅", "")).ne).toBe("Saved ✅");
    expect(readSavedMessage(savedMessage("", "सुरक्षित भयो ✅")).en).toBe("सुरक्षित भयो ✅");
  });

  it("reads nothing as nothing, rather than as a stray separator", () => {
    expect(readSavedMessage("")).toEqual({ en: "", ne: "" });
    expect(readSavedMessage("   ")).toEqual({ en: "", ne: "" });
  });

  it("keeps a sentence that contains a single bar intact", () => {
    // "Paid | due" reads as one sentence; only the three-bar separator splits.
    const packed = savedMessage("Paid | due updated ✅", "तिरेको | बाँकी मिल्यो ✅");

    expect(readSavedMessage(packed)).toEqual({
      en: "Paid | due updated ✅",
      ne: "तिरेको | बाँकी मिल्यो ✅",
    });
  });
});
