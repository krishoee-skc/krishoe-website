import { describe, expect, it } from "vitest";
import { saveFailureMessage } from "@/lib/postgres/retryable";

// What the admin reads when a save does not land. A dropped Neon connection is
// not their mistake and pressing Save again fixes it, so it must say that — the
// driver's own wording ("Client has encountered a connection error and is not
// queryable") tells the shop owner nothing they can act on.
describe("the message shown when a save fails", () => {
  it("tells the owner to press save again when the connection dropped", () => {
    const message = saveFailureMessage(
      new Error("Connection terminated unexpectedly"),
      "Could not save this product.",
    );

    expect(message).toContain("press Save again");
    expect(message).toContain("Nothing you typed was lost");
  });

  it("passes a real problem through so it can be acted on", () => {
    const message = saveFailureMessage(
      Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" }),
      "Could not save this product.",
    );

    expect(message).toBe("duplicate key value violates unique constraint");
  });

  it("falls back when the failure carries no message", () => {
    expect(saveFailureMessage("something thrown that is not an Error", "Could not save this product."))
      .toBe("Could not save this product.");
    expect(saveFailureMessage(new Error(""), "Could not save this product."))
      .toBe("Could not save this product.");
  });
});
