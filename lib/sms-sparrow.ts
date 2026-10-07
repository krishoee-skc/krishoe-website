/**
 * Sparrow SMS, Nepal's own gateway (owner, 2026-10-07).
 *
 * Twilio sends from an American number: dearer per message to NTC and Ncell,
 * and some never arrive. Sparrow sends from the shop's own name ("KRISHOE")
 * once the sender ID is registered with them. It is used first for a Nepali
 * number when SPARROW_SMS_TOKEN and SPARROW_SMS_FROM are set; Twilio stays as
 * the fallback, and for a number outside Nepal.
 */
const SPARROW_URL = "https://api.sparrowsms.com/v2/sms/";

export function sparrowConfig() {
  const token = process.env.SPARROW_SMS_TOKEN?.trim() ?? "";
  const from = process.env.SPARROW_SMS_FROM?.trim() ?? "";
  return token && from ? { token, from } : null;
}

/**
 * A Nepali mobile as Sparrow wants it — ten digits, "98…" or "97…" — or null
 * for anything else (a landline, a number abroad, a typo).
 */
export function nepaliMobile(phone: string): string | null {
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00977")) digits = digits.slice(5);
  else if (digits.startsWith("977") && digits.length === 13) digits = digits.slice(3);
  return /^9[78]\d{8}$/.test(digits) ? digits : null;
}

/** The same number for Twilio: +977 in front of a Nepali mobile, else as typed with a +. */
export function e164(phone: string): string {
  const nepali = nepaliMobile(phone);
  if (nepali) return `+977${nepali}`;
  const digits = phone.replace(/\D/g, "");
  return phone.trim().startsWith("+") || digits.length > 10 ? `+${digits}` : phone.trim();
}

type SparrowReply = { response_code?: number; response?: string; message_id?: string | number };

/** Send one SMS through Sparrow. Returns its reference, or throws with Sparrow's own words. */
export async function sendViaSparrow(to: string, text: string): Promise<string> {
  const config = sparrowConfig();
  const mobile = nepaliMobile(to);
  if (!config) throw new Error("Sparrow SMS is not set up.");
  if (!mobile) throw new Error(`${to} is not a Nepali mobile number.`);

  const response = await fetch(SPARROW_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token: config.token, from: config.from, to: mobile, text }),
    signal: AbortSignal.timeout(10_000),
  });
  const reply = (await response.json().catch(() => ({}))) as SparrowReply;
  if (!response.ok || reply.response_code !== 200) {
    throw new Error(`Sparrow refused: ${reply.response ?? `HTTP ${response.status}`}`);
  }
  return `sparrow_${reply.message_id ?? Date.now()}`;
}
