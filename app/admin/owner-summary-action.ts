"use server";

import { requireAdminPermission } from "@/lib/admin-permissions";
import { askGemini } from "@/lib/ai/gemini";
import { reportError } from "@/lib/report-error";

/**
 * The figures on the Owner's dashboard, as the dashboard already shows them —
 * nothing more is read or sent than is on the screen.
 */
export type OwnerSummaryFacts = {
  today: { net: number; bills: number; pairs: number; newOrders: number };
  week: number;
  month: number;
  salesGoal: number;
  todos: string[];
  lowShoes: Array<{ name: string; stock: number }>;
  factoryTodayPairs: number;
  creditOwed: number;
  workerDue: number;
};

export type OwnerSummaryResult = { ok: true; points: string[]; byAi: boolean } | { ok: false; message: string };

const rupees = (value: number) => `रु. ${Math.round(value).toLocaleString("en-IN")}`;

/** The summary without AI: the same facts, in order, in plain words. */
export async function ruleSummary(facts: OwnerSummaryFacts): Promise<string[]> {
  const points: string[] = [];
  for (const todo of facts.todos.slice(0, 3)) points.push(todo);
  if (facts.lowShoes.length > 0) {
    points.push(`सकिन लागेका: ${facts.lowShoes.slice(0, 3).map((shoe) => `${shoe.name} (${shoe.stock})`).join(", ")} — बनाउने वा किन्ने हेर्नुहोस्।`);
  }
  if (facts.creditOwed > 0) points.push(`ग्राहकबाट उठाउन बाँकी उधारो ${rupees(facts.creditOwed)}।`);
  if (facts.workerDue > 0) points.push(`कामदारलाई तिर्न बाँकी ${rupees(facts.workerDue)}।`);
  if (facts.salesGoal > 0) points.push(`यो महिना ${rupees(facts.month)} बिक्री, लक्ष्य ${rupees(facts.salesGoal)}।`);
  return points.slice(0, 5);
}

/**
 * "What do I do today", written for the Owner (owner, 2026-10-01): three to
 * five short points in Nepali, most urgent first, from the dashboard's own
 * figures. Read-only — it changes nothing. Without AI, or when the AI fails,
 * the same facts come back in plain order instead, so the button always
 * answers.
 */
export async function ownerSummaryAction(facts: OwnerSummaryFacts): Promise<OwnerSummaryResult> {
  await requireAdminPermission("dashboard:read");
  const fallback = await ruleSummary(facts);
  const prompt = [
    "You help the owner of KRISHOE, a small footwear shop and factory in Nepal.",
    "From the facts below only, write 3 to 5 short points for today, most urgent first.",
    "Write in simple Nepali (Devanagari). Each point one line, under 20 words, starting with an action.",
    "Use only numbers that appear in the facts. Do not invent sales, stock or names. No greeting, no headings.",
    "Return the points as a JSON array of strings.",
    "",
    `Facts: ${JSON.stringify(facts)}`,
  ].join("\n");
  try {
    const answer = await askGemini(prompt, { asJson: true });
    if (!answer.ok) return { ok: true, points: fallback, byAi: false };
    const parsed: unknown = JSON.parse(answer.text);
    const points = Array.isArray(parsed)
      ? parsed.filter((point): point is string => typeof point === "string" && point.trim() !== "").map((point) => point.trim().slice(0, 200))
      : [];
    return points.length > 0 ? { ok: true, points: points.slice(0, 5), byAi: true } : { ok: true, points: fallback, byAi: false };
  } catch (error) {
    reportError("write the owner's summary", error);
    return { ok: true, points: fallback, byAi: false };
  }
}
