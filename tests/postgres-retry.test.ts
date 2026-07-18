import { describe, expect, it } from "vitest";
import { isRetryableConnectionError } from "@/lib/postgres/client";

// The Neon pooled endpoint reports a dropped connection in several shapes.
// Each of these should be retried — a fresh connection recovers the request
// instead of showing the storefront's retry page. A real SQL error must not,
// or a genuine bug would be retried and hidden.
describe("which database errors are worth retrying", () => {
  const retryable = [
    Object.assign(new Error("Connection terminated unexpectedly"), {}),
    Object.assign(new Error("Client has encountered a connection error and is not queryable"), {}),
    Object.assign(new Error("terminating connection due to administrator command"), { code: "57P01" }),
    Object.assign(new Error("read ECONNRESET"), { code: "ECONNRESET" }),
    Object.assign(new Error("write EPIPE"), { code: "EPIPE" }),
    Object.assign(new Error("connection timeout"), {}),
    Object.assign(new Error("server closed the connection unexpectedly"), {}),
    Object.assign(new Error("whatever"), { code: "08006" }),
  ];

  for (const error of retryable) {
    it(`retries: ${(error as Error).message.slice(0, 40)}`, () => {
      expect(isRetryableConnectionError(error)).toBe(true);
    });
  }

  const notRetryable = [
    // A real schema/constraint problem — retrying would just hide the bug.
    Object.assign(new Error('column "foo" does not exist'), { code: "42703" }),
    Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" }),
    Object.assign(new Error("null value in column violates not-null constraint"), { code: "23502" }),
    new Error("something entirely unrelated"),
    "a plain string",
    null,
    undefined,
  ];

  for (const [index, error] of notRetryable.entries()) {
    it(`does not retry case ${index + 1}`, () => {
      expect(isRetryableConnectionError(error)).toBe(false);
    });
  }
});
