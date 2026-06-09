// Error-as-node-status: an errored memo remembers its error and rethrows it on read
// (instead of re-deriving it by re-running the getter), so the error propagates and
// coheres downstream like a value. These tests pin the guarantees that distinguish
// node-status from the previous transient "re-throw on every read" behavior.
import { describe, it, expect, vi } from "vite-plus/test";
import { signal, computed, effect, root, catchError, flushSync } from "../../src/index";

describe("computed error status", () => {
  it("remembers the error — the getter runs once across repeated reads", () => {
    const getter = vi.fn(() => {
      throw new Error("boom");
    });
    const c = computed(getter);
    expect(() => c()).toThrow("boom");
    expect(() => c()).toThrow("boom");
    expect(() => c()).toThrow("boom");
    expect(getter).toHaveBeenCalledTimes(1); // not re-derived on every read
  });

  it("rethrows the same normalized Error instance each read", () => {
    const c = computed(() => {
      throw "plain"; // non-Error → normalized once and remembered
    });
    let first: unknown;
    let second: unknown;
    try {
      c();
    } catch (e) {
      first = e;
    }
    try {
      c();
    } catch (e) {
      second = e;
    }
    expect(first).toBeInstanceOf(Error);
    expect(first).toBe(second);
    expect((first as Error).message).toBe("plain");
  });

  it("coheres downstream — a memo reading an errored memo is itself errored", () => {
    const base = computed((): number => {
      throw new Error("root-cause");
    });
    const derived = computed(() => base() + 1);
    expect(() => derived()).toThrow("root-cause");
  });

  it("a chain of readers all surface the error, but the source getter runs once", () => {
    const getter = vi.fn((): number => {
      throw new Error("x");
    });
    const a = computed(getter);
    const b = computed(() => a());
    const c = computed(() => b());
    expect(() => c()).toThrow("x");
    expect(() => b()).toThrow("x");
    expect(() => a()).toThrow("x");
    expect(getter).toHaveBeenCalledTimes(1);
  });

  it("clears the error and recovers when a dependency changes", () => {
    const s = signal(0);
    const getter = vi.fn((): number => {
      if (s() === 0) throw new Error("bad");
      return s() * 2;
    });
    const c = computed(getter);

    expect(() => c()).toThrow("bad");
    flushSync(() => s(2));
    expect(c()).toBe(4); // recovered
    expect(c()).toBe(4); // stable, getter not re-run
    expect(getter).toHaveBeenCalledTimes(2); // initial throw + one recompute
  });

  it("re-errors with a fresh error after recovering", () => {
    const s = signal(1);
    const c = computed((): number => {
      if (s() < 0) throw new Error(`neg:${s()}`);
      return s();
    });
    expect(c()).toBe(1);
    flushSync(() => s(-5));
    expect(() => c()).toThrow("neg:-5");
    flushSync(() => s(7));
    expect(c()).toBe(7);
  });

  it("an errored branch does not corrupt a sibling sharing the same source", () => {
    const s = signal(1);
    const ok = computed(() => s() + 1);
    const bad = computed((): number => {
      if (s() > 0) throw new Error("bad");
      return 0;
    });
    expect(ok()).toBe(2);
    expect(() => bad()).toThrow("bad");
    expect(ok()).toBe(2); // sibling still consistent after the other errored
    flushSync(() => s(10));
    expect(ok()).toBe(11); // and still updates normally
  });

  it("an effect reading an errored memo routes to the boundary; getter runs once", () => {
    const getter = vi.fn((): number => {
      throw new Error("from-memo");
    });
    const handler = vi.fn();
    root(() => {
      const c = computed(getter);
      catchError(() => {
        effect(() => {
          c();
        });
      }, handler);
    });
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0]![0] as Error).message).toBe("from-memo");
    expect(getter).toHaveBeenCalledTimes(1);
  });

  it("recovers a downstream effect once the memo's error clears", async () => {
    const s = signal(0);
    const c = computed((): number => {
      if (s() === 0) throw new Error("loading");
      return s();
    });
    const seen: number[] = [];
    const errors: string[] = [];
    root(() => {
      catchError(
        () => {
          effect(() => {
            seen.push(c());
          });
        },
        (e) => errors.push(e.message),
      );
    });
    expect(errors).toEqual(["loading"]); // initial read errors → routed
    expect(seen).toEqual([]);
    s(3);
    await Promise.resolve();
    expect(seen).toEqual([3]); // memo recovered → effect re-ran with the value
  });
});
