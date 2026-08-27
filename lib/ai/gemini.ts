/**
 * The one place this app talks to Google.
 *
 * Everything about the shop's AI is written to fail in the direction of doing
 * nothing. There is no key on most machines and there will be days the free
 * tier is spent, so "the model is unavailable" is not an error path here — it
 * is the normal state, and every caller has to keep working through it. That is
 * why this returns a result object rather than throwing: a screen that forgot a
 * try/catch would otherwise take a page down for a feature nobody depends on.
 *
 * What crosses this boundary is decided by the caller and nothing else. This
 * function takes a finished prompt string; it never reads the database, never
 * sees a customer, and never learns anything it was not handed.
 */

import { reportError } from "@/lib/report-error";

/**
 * Google's free tier trains on what is sent to it.
 *
 * That is the whole reason only shop-front product copy goes through here: a
 * shoe's name, its price and its material are already printed on the website
 * for anyone to read. A customer's phone number is not. The rule lives in the
 * callers, and `tests/ai-stays-in-its-lane.test.ts` is what keeps it true.
 */
export const AI_MODEL = "gemini-3.6-flash";

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Long enough for a slow Nepali connection, short enough that nobody waits. */
const TIMEOUT_MS = 30_000;

/**
 * A sentence in both languages, because a failure is read by a person.
 *
 * `detail` beside it stays English on purpose: it is the engineering half —
 * quota numbers, HTTP codes, the name of the environment variable — written for
 * whoever is fixing it, and it goes into the audit log rather than onto a card.
 */
export type Bilingual = { en: string; ne: string };

export type AiResult =
  | { ok: true; text: string; model: string; tookMs: number; tokensIn: number; tokensOut: number }
  | { ok: false; reason: Bilingual; detail: string };

/** Whether the shop has AI at all. False is a perfectly normal answer. */
export function isAiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/**
 * Turns Google's failures into a sentence the shop can act on.
 *
 * "429" tells the owner nothing. "Today's free limit is spent, it resets
 * tomorrow" tells him to stop pressing the button and come back — which is the
 * only thing he could usefully do.
 */
function readFailure(status: number, body: unknown): { reason: Bilingual; detail: string } {
  const message =
    (body as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${status}`;

  if (status === 429) {
    return {
      reason: {
        en: "Today's free limit is used up",
        ne: "आजको नि:शुल्क सीमा सकियो",
      },
      detail: "Google's free daily quota for this key is spent. It resets on its own; nothing is charged.",
    };
  }

  if (status === 400 && /API key not valid/i.test(message)) {
    return {
      reason: { en: "The API key was refused", ne: "API key मिलेन" },
      detail: "GEMINI_API_KEY was rejected. Make a new one at aistudio.google.com/apikey and replace it in .env.local.",
    };
  }

  if (status === 403) {
    return {
      reason: { en: "This key is not allowed to do that", ne: "यो key लाई अनुमति छैन" },
      detail: `Google refused this key: ${message}`,
    };
  }

  if (status === 404) {
    return {
      reason: { en: "This AI model is no longer available", ne: "यो AI model अब उपलब्ध छैन" },
      detail: `Google retired ${AI_MODEL}: ${message}`,
    };
  }

  if (status >= 500) {
    return {
      reason: { en: "Google's service is down right now", ne: "Google को सेवा अहिले बन्द छ" },
      detail: `Google returned ${status}. This is on their side; try again later.`,
    };
  }

  return { reason: { en: "The AI did not answer", ne: "AI ले जवाफ दिएन" }, detail: message };
}

/**
 * Asks the model one question and returns what it said.
 *
 * `asJson` puts Google's own structured-output mode on, which is what stops the
 * model wrapping its answer in a markdown fence and the caller parsing prose.
 */
export async function askGemini(prompt: string, options: { asJson?: boolean } = {}): Promise<AiResult> {
  const key = process.env.GEMINI_API_KEY?.trim();

  if (!key) {
    return {
      ok: false,
      reason: { en: "AI is not connected", ne: "AI जोडिएको छैन" },
      detail: "GEMINI_API_KEY is not set. The app works fully without it; this feature is simply absent.",
    };
  }

  const started = Date.now();
  const abort = AbortSignal.timeout(TIMEOUT_MS);

  try {
    const response = await fetch(`${ENDPOINT}/${AI_MODEL}:generateContent?key=${key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: abort,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          ...(options.asJson ? { responseMimeType: "application/json" } : {}),
        },
      }),
    });

    const body = (await response.json().catch(() => null)) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    } | null;

    if (!response.ok) {
      const failure = readFailure(response.status, body);
      // Not reportError: a spent free quota is expected, not a fault.
      return { ok: false, ...failure };
    }

    const text = body?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";

    if (!text) {
      return {
        ok: false,
        reason: { en: "The AI sent back an empty answer", ne: "AI ले खाली जवाफ पठायो" },
        detail: "The model returned no text, usually because its own safety filter stopped the answer.",
      };
    }

    return {
      ok: true,
      text,
      model: AI_MODEL,
      tookMs: Date.now() - started,
      tokensIn: body?.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: body?.usageMetadata?.candidatesTokenCount ?? 0,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        ok: false,
        reason: { en: "The AI did not answer in time", ne: "AI ले समयमा जवाफ दिएन" },
        detail: `No answer within ${TIMEOUT_MS / 1000} seconds. Nothing was saved.`,
      };
    }

    reportError("ask gemini", error);
    return {
      ok: false,
      reason: { en: "Could not reach the AI", ne: "AI सँग जोडिन सकिएन" },
      detail: error instanceof Error ? error.message : "The request never reached Google.",
    };
  }
}
