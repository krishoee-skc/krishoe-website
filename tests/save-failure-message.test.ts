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

  it("explains a real problem so it can be acted on", () => {
    const message = saveFailureMessage(
      Object.assign(new Error("duplicate key value violates unique constraint"), { code: "23505" }),
      "Could not save this product.",
    );

    // It used to hand back the database's own sentence. That names the rule
    // and not the remedy, and "violates unique constraint" is not a thing to
    // say to a shopkeeper — so a refusal is explained now, and the fallback is
    // still not used, which is what this test was always really about.
    expect(message).not.toBe("Could not save this product.");
    expect(message).toContain("already exists");
  });

  it("falls back when the failure carries no message", () => {
    expect(saveFailureMessage("something thrown that is not an Error", "Could not save this product."))
      .toBe("Could not save this product.");
    expect(saveFailureMessage(new Error(""), "Could not save this product."))
      .toBe("Could not save this product.");
  });
});
