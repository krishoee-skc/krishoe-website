import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { askGemini, isAiConfigured } from "@/lib/ai/gemini";
import {
  buildAdminAssistantPrompt,
  adminFactsBlock,
  type AdminChatTurn,
} from "@/lib/ai/admin-assistant-prompt";
import { readAdminFacts } from "@/lib/admin-facts";

/**
 * The owner's private assistant inside the admin.
 *
 * Read-only and login-guarded by construction, and — unlike the shopfront
 * assistant — given the shop's true figures, because it speaks to the owner
 * about their own shop. But it is handed those figures already computed, from
 * the very same snapshots the dashboard renders. The model never works a number
 * out; it reads what it is given and says it back in the owner's language. It
 * cannot place an order, pay a wage or change stock — there is no such code path
 * here, and the prompt tells it so in the strongest terms.
 *
 * The safety net (the owner's allow-list, made real): the true numbers are read
 * first, and always returned in `facts`. The AI sentence is layered on top. So
 * if the AI quota is spent or the key is missing, the box still shows the real
 * numbers — it simply doesn't wrap them in a sentence. It is never blank, and
 * never a guessed number.
 */

const MAX_MESSAGE = 500;

export async function POST(request: Request) {
  const adminUser = await requireAdminPermission("production:entry");
  if (!adminUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { message?: unknown; history?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const message =
    typeof payload.message === "string" ? payload.message.trim().slice(0, MAX_MESSAGE) : "";
  if (!message) {
    return NextResponse.json({ error: "Empty message" }, { status: 400 });
  }

  const history: AdminChatTurn[] = Array.isArray(payload.history)
    ? (payload.history as unknown[])
        .filter(
          (turn): turn is AdminChatTurn =>
            typeof turn === "object" &&
            turn !== null &&
            "role" in turn &&
            ((turn as AdminChatTurn).role === "user" || (turn as AdminChatTurn).role === "assistant") &&
            typeof (turn as AdminChatTurn).text === "string",
        )
        .map((turn) => ({ role: turn.role, text: turn.text.slice(0, MAX_MESSAGE) }))
    : [];

  // The true numbers, read first and always returned. This is the safety net:
  // whatever happens with the AI below, the box has the real figures to show.
  // Same reader the facts API uses, so the two never disagree.
  const facts = await readAdminFacts();

  // No AI on this deployment, or the quota is spent: return the facts with no
  // sentence. The box shows the real numbers rather than an error or a blank.
  if (!isAiConfigured()) {
    return NextResponse.json({ ok: true, facts, reply: null, factsText: adminFactsBlock(facts) });
  }

  const result = await askGemini(buildAdminAssistantPrompt(facts, history, message));

  return NextResponse.json({
    ok: true,
    facts,
    // The AI sentence sits on top of the facts. If the AI failed, reply is null
    // and the caller falls back to showing the numbers plainly.
    reply: result.ok ? result.text : null,
    factsText: adminFactsBlock(facts),
  });
}
