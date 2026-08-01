import { describe, expect, it } from "vitest";
import { createIdempotencyKeyRegistry } from "@/app/admin/factory/_components/idempotency-key";

describe("factory idempotency key registry", () => {
  it("keeps a key stable until the caller confirms success and rotates it", () => {
    const generated = ["first", "second", "third"];
    const registry = createIdempotencyKeyRegistry(() => generated.shift()!);

    expect(registry.get("work")).toBe("first");
    expect(registry.get("work")).toBe("first");
    expect(registry.rotate("work")).toBe("second");
    expect(registry.get("work")).toBe("second");
  });

  it("keeps independent keys for concurrent mutation scopes", () => {
    let sequence = 0;
    const registry = createIdempotencyKeyRegistry(() => `key-${++sequence}`);

    expect(registry.get("salary-advance")).toBe("key-1");
    expect(registry.get("salary-payment")).toBe("key-2");
    expect(registry.get("salary-advance")).toBe("key-1");
    expect(registry.rotate("salary-payment")).toBe("key-3");
    expect(registry.get("salary-advance")).toBe("key-1");
  });

  it("recovers the same key after a tab refresh until a save succeeds", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
    };
    const first = createIdempotencyKeyRegistry(() => "persisted-key", storage);
    expect(first.get("payment:worker-1:100")).toBe("persisted-key");

    const afterRefresh = createIdempotencyKeyRegistry(() => "should-not-be-used", storage);
    expect(afterRefresh.get("payment:worker-1:100")).toBe("persisted-key");
    expect(afterRefresh.rotate("payment:worker-1:100")).toBe("should-not-be-used");
  });
});
