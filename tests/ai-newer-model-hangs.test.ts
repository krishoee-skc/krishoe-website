import { afterEach, describe, expect, it, vi } from "vitest";
import { askGemini, AI_MODELS } from "@/lib/ai/gemini";

/**
 * 2026-10-29: gemini-3.7-flash took the question and never answered; the
 * whole 30 seconds went on it, and the proven model — which answered in two —
 * was never asked. The robot and the assistant both said "did not answer".
 */
describe("a newer model that hangs", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("hands the question to the proven model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      const model = AI_MODELS.find((name) => url.includes(`/${name}:`)) ?? "";
      asked.push(model);
      if (model !== AI_MODELS[AI_MODELS.length - 1]) {
        const timeout = new Error("The operation timed out.");
        timeout.name = "TimeoutError";
        throw timeout;
      }
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: '{"ok":true}' }] } }] }), { status: 200 });
    });
    const answer = await askGemini("Say OK", { asJson: true });
    expect(asked).toEqual([...AI_MODELS]);
    expect(answer).toMatchObject({ ok: true, model: AI_MODELS[AI_MODELS.length - 1] });
  });

  it("still says it did not answer when the proven model hangs too", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", async () => {
      const timeout = new Error("The operation timed out.");
      timeout.name = "TimeoutError";
      throw timeout;
    });
    const answer = await askGemini("Say OK");
    expect(answer).toMatchObject({ ok: false, reason: { en: "The AI did not answer in time" } });
  });

  it("does not move on for a spent daily quota, which is the same on every model", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url);
      return new Response(JSON.stringify({ error: { status: "RESOURCE_EXHAUSTED", message: "quota" } }), { status: 429 });
    });
    const answer = await askGemini("Say OK");
    expect(asked).toHaveLength(1);
    expect(answer.ok).toBe(false);
  });
});
