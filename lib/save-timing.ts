import { logPerformanceMetric } from "@/lib/monitoring";

/**
 * How long one admin save took, measured on the server from the press to the
 * answer (owner, 2026-09-30: "saving is slow"). Filed under metric "SAVE", so
 * the shoppers' page-paint figures never average it in, and shown on the
 * monitoring screen by what was saved. Never fails the save it measures.
 */
export async function recordSaveTime(what: string, startedAt: number) {
  await logPerformanceMetric({
    path: what,
    method: "POST",
    metric: "SAVE",
    duration: Math.max(0, Date.now() - startedAt),
    statusCode: 200,
  });
}
