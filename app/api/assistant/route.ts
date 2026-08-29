import { NextResponse } from "next/server";
import { askGemini, isAiConfigured } from "@/lib/ai/gemini";
import { assistantCatalog, buildAssistantPrompt, type ChatTurn } from "@/lib/ai/assistant-prompt";
import { getProducts } from "@/lib/product-store";
import { businessContact } from "@/lib/seo";
import { checkAndRecordSubmissionLimit } from "@/lib/submission-rate-limit";

/**
 * The shop's front-of-house AI assistant.
 *
 * Read-only by construction: it loads the public catalog and hands the model a
 * finished prompt (built in lib/ai/assistant-prompt.ts, where a test proves what
 * crosses to Google). It cannot place an order, change stock or a price, or see
 * a customer's account — the only things it is given are what is already printed
 * on the website plus the shop's public policies. Anything it cannot answer, it
 * hands to WhatsApp.
 *
 * A spent free quota or a missing key is a normal state, not an error: the
 * assistant simply falls back to WhatsApp so a real person can help.
 */

const MAX_MESSAGE = 500;

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

function fallbackReply() {
  return `I can't answer that right now — please message KRISHOE on WhatsApp at ${businessContact.whatsappDisplay} and we'll help you straight away. 🙏`;
}

export async function POST(request: Request) {
  let payload: { message?: unknown; history?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, reply: fallbackReply() }, { status: 400 });
  }

  const message = typeof payload.message === "string" ? payload.message.trim().slice(0, MAX_MESSAGE) : "";
  if (!message) {
    return NextResponse.json({ ok: false, reply: fallbackReply() }, { status: 400 });
  }

  const history: ChatTurn[] = Array.isArray(payload.history)
    ? (payload.history as unknown[])
        .filter(
          (turn): turn is ChatTurn =>
            typeof turn === "object" &&
            turn !== null &&
            "role" in turn &&
            ((turn as ChatTurn).role === "user" || (turn as ChatTurn).role === "assistant") &&
            typeof (turn as ChatTurn).text === "string",
        )
        .map((turn) => ({ role: turn.role, text: turn.text.slice(0, MAX_MESSAGE) }))
    : [];

  const rateLimit = await checkAndRecordSubmissionLimit({
    bucket: "assistant",
    key: clientKey(request),
    maxAttempts: 20,
    windowMs: 60_000,
  });

  if (rateLimit.limited) {
    return NextResponse.json({
      ok: true,
      reply: `You've sent a lot of messages quickly — please wait a moment, or message us on WhatsApp at ${businessContact.whatsappDisplay}.`,
    });
  }

  // No key / no AI on this deployment is a normal state, not an error.
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: true, reply: fallbackReply() });
  }

  const products = await getProducts();
  const result = await askGemini(buildAssistantPrompt(assistantCatalog(products), history, message));

  if (!result.ok) {
    return NextResponse.json({ ok: true, reply: fallbackReply() });
  }

  return NextResponse.json({ ok: true, reply: result.text });
}
