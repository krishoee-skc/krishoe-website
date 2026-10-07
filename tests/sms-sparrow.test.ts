import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { e164, nepaliMobile, sendViaSparrow } from "@/lib/sms-sparrow";

/**
 * Owner, 2026-10-07: SMS to a Nepali mobile goes through Sparrow SMS, Nepal's
 * own gateway, from the shop's name; Twilio stays the fallback.
 */
describe("the number each gateway is handed", () => {
  it("reads a Nepali mobile however it was typed", () => {
    expect(nepaliMobile("9766630193")).toBe("9766630193");
    expect(nepaliMobile("+977 976-6630193")).toBe("9766630193");
    expect(nepaliMobile("00977 9855019351")).toBe("9855019351");
  });

  it("is not fooled by a landline or a number abroad", () => {
    expect(nepaliMobile("056-123456")).toBeNull();
    expect(nepaliMobile("+91 98765 43210")).toBeNull();
  });

  it("puts +977 in front for Twilio", () => {
    expect(e164("9766630193")).toBe("+9779766630193");
    expect(e164("+91 98765 43210")).toBe("+919876543210");
  });
});

describe("sending through Sparrow", () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    process.env.SPARROW_SMS_TOKEN = "token";
    process.env.SPARROW_SMS_FROM = "KRISHOE";
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => {
    delete process.env.SPARROW_SMS_TOKEN;
    delete process.env.SPARROW_SMS_FROM;
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("posts the ten digits, the sender and the words", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ response_code: 200, message_id: 42 }), { status: 200 }));
    expect(await sendViaSparrow("+977 9766630193", "Your order is confirmed.")).toBe("sparrow_42");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.sparrowsms.com/v2/sms/");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("to")).toBe("9766630193");
    expect(body.get("from")).toBe("KRISHOE");
    expect(body.get("text")).toBe("Your order is confirmed.");
  });

  it("throws with Sparrow's own words when it refuses", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ response_code: 1002, response: "Invalid Token" }), { status: 403 }));
    await expect(sendViaSparrow("9766630193", "x")).rejects.toThrow("Sparrow refused: Invalid Token");
  });
});
