import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cacheBriefly } from "@/lib/brief-cache";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// One load of the admin dashboard ran the same ten-table read twelve times.
// This is what stops that — so what it must and must not do is worth pinning
// exactly: serving a stale read to a writer would put the shop's stock wrong.
describe("a read reused for a moment", () => {
  it("asks once when asked twice in the same instant", async () => {
    const load = vi.fn().mockResolvedValue("stock");
    const read = cacheBriefly(load);

    await Promise.all([read(), read(), read()]);

    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shares one in-flight request rather than starting a second", async () => {
    let release: (value: string) => void = () => {};
    const load = vi.fn().mockReturnValue(
      new Promise<string>((resolve) => {
        release = resolve;
      }),
    );
    const read = cacheBriefly(load);

    const first = read();
    const second = read();
    release("stock");

    expect(await first).toBe("stock");
    expect(await second).toBe("stock");
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("asks again once the moment has passed", async () => {
    const load = vi.fn().mockResolvedValue("stock");
    const read = cacheBriefly(load, 1_000);

    await read();
    vi.advanceTimersByTime(1_001);
    await read();

    expect(load).toHaveBeenCalledTimes(2);
  });

  it("holds the value for the whole window and not a moment longer", async () => {
    const load = vi.fn().mockResolvedValue("stock");
    const read = cacheBriefly(load, 1_000);

    await read();
    vi.advanceTimersByTime(999);
    await read();
    expect(load).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2);
    await read();
    expect(load).toHaveBeenCalledTimes(2);
  });

  // A dropped connection is the failure this app actually sees. Caching it
  // would hand the same failure to every caller for a second, turning one
  // unlucky query into a page that cannot load at all.
  it("does not cache a failure", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("Connection terminated unexpectedly"))
      .mockResolvedValue("stock");
    const read = cacheBriefly(load);

    await expect(read()).rejects.toThrow("Connection terminated");
    await expect(read()).resolves.toBe("stock");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("leaves no unhandled rejection behind when a read fails", async () => {
    const unhandled = vi.fn();
    process.on("unhandledRejection", unhandled);

    const read = cacheBriefly(vi.fn().mockRejectedValue(new Error("nope")));
    await expect(read()).rejects.toThrow("nope");
    await vi.advanceTimersByTimeAsync(0);

    process.off("unhandledRejection", unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });

  it("keeps separate caches for separate readers", async () => {
    const stock = vi.fn().mockResolvedValue("stock");
    const orders = vi.fn().mockResolvedValue("orders");

    expect(await cacheBriefly(stock)()).toBe("stock");
    expect(await cacheBriefly(orders)()).toBe("orders");
  });
});
