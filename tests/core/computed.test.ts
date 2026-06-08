import { describe, it, vi, expect } from "vite-plus/test";
import { signal, computed, effect, root, onCleanup } from "../../src/index";

describe("computed", () => {
  describe("laziness & caching", () => {
    it("does not compute until first read", () => {
      const spy = vi.fn();
      computed(() => spy());
      expect(spy).toHaveBeenCalledTimes(0);
    });

    it("computes on first read and caches the result", () => {
      const spy = vi.fn(() => 42);
      const c = computed(spy);
      expect(c()).toBe(42);
      expect(c()).toBe(42);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("recomputes only after a dependency changes, and only on read", () => {
      const spy = vi.fn();
      const s = signal(1);
      const c = computed(() => {
        spy();
        return s() * 2;
      });
      expect(c()).toBe(2);
      expect(spy).toHaveBeenCalledTimes(1);
      c();
      expect(spy).toHaveBeenCalledTimes(1);
      s(2);
      // not recomputed until read
      expect(spy).toHaveBeenCalledTimes(1);
      expect(c()).toBe(4);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("coalesces multiple changes into one recompute", () => {
      const spy = vi.fn();
      const s = signal(1);
      const c = computed(() => {
        spy();
        return s();
      });
      c();
      s(2);
      s(3);
      s(4);
      expect(c()).toBe(4);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("does not recompute if a dependency is set back to the same value", () => {
      const spy = vi.fn();
      const s = signal(1);
      const c = computed(() => {
        spy();
        return s();
      });
      c();
      s(1);
      expect(c()).toBe(1);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("previous value", () => {
    it("passes the previous value to the getter", () => {
      const seen: Array<number | undefined> = [];
      const s = signal(1);
      const c = computed<number>((prev) => {
        seen.push(prev);
        return s();
      });
      expect(c()).toBe(1);
      s(2);
      expect(c()).toBe(2);
      s(3);
      expect(c()).toBe(3);
      expect(seen).toEqual([undefined, 1, 2]);
    });
  });

  describe("composition", () => {
    it("supports a computed reading another computed", () => {
      const s = signal(2);
      const doubled = computed(() => s() * 2);
      const plusOne = computed(() => doubled() + 1);
      expect(plusOne()).toBe(5);
      s(3);
      expect(plusOne()).toBe(7);
    });

    it("computes a diamond dependency once", () => {
      const spy = vi.fn();
      const s = signal(1);
      const a = computed(() => s() + 1);
      const b = computed(() => s() + 2);
      const d = computed(() => {
        spy();
        return a() + b();
      });
      expect(d()).toBe(5);
      expect(spy).toHaveBeenCalledTimes(1);
      s(2);
      expect(d()).toBe(7);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("gates downstream when its own value is unchanged", () => {
      const spy = vi.fn();
      const s = signal(2);
      const even = computed(() => s() % 2 === 0);
      const c = computed(() => {
        spy();
        return even();
      });
      expect(c()).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      s(4); // still even → `even` value unchanged → downstream not recomputed
      expect(c()).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      s(5); // odd → changed
      expect(c()).toBe(false);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("drives an effect and recomputes once per change", async () => {
      const spy = vi.fn();
      const s = signal(1);
      root(() => {
        const c = computed(() => s() * 10);
        effect(() => spy(c()));
      });
      expect(spy).toHaveBeenLastCalledWith(10);
      s(2);
      s(3);
      await Promise.resolve();
      expect(spy).toHaveBeenLastCalledWith(30);
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("does not recompute when read inside an effect that already cached it", async () => {
      const spy = vi.fn();
      const s = signal(1);
      root(() => {
        const c = computed(() => {
          spy();
          return s();
        });
        c(); // prime
        effect(() => {
          c();
        });
      });
      expect(spy).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("dynamic dependencies", () => {
    it("drops dependencies no longer read", () => {
      const spy = vi.fn();
      const cond = signal(true);
      const a = signal("a");
      const b = signal("b");
      const c = computed(() => {
        spy();
        return cond() ? a() : b();
      });
      expect(c()).toBe("a");
      expect(spy).toHaveBeenCalledTimes(1);
      // while cond is true, b is not a dependency
      b("b2");
      expect(c()).toBe("a");
      expect(spy).toHaveBeenCalledTimes(1);
      cond(false);
      expect(c()).toBe("b2");
      expect(spy).toHaveBeenCalledTimes(2);
      // now a is not a dependency
      a("a2");
      expect(c()).toBe("b2");
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe("onCleanup", () => {
    it("runs cleanups before each recompute", () => {
      const cleanup = vi.fn();
      const s = signal(1);
      const c = computed(() => {
        s();
        onCleanup(cleanup);
      });
      c();
      expect(cleanup).toHaveBeenCalledTimes(0);
      s(2);
      c();
      expect(cleanup).toHaveBeenCalledTimes(1);
      s(3);
      c();
      expect(cleanup).toHaveBeenCalledTimes(2);
    });

    it("runs cleanups when the memo loses its last subscriber", () => {
      const cleanup = vi.fn();
      const s = signal(1);
      const disposeRoot = root(() => {
        const c = computed(() => {
          s();
          onCleanup(cleanup);
        });
        effect(() => c());
      });
      expect(cleanup).toHaveBeenCalledTimes(0);
      disposeRoot();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("supports multiple cleanups (LIFO)", () => {
      const order: number[] = [];
      const s = signal(1);
      const c = computed(() => {
        s();
        onCleanup(() => order.push(1));
        onCleanup(() => order.push(2));
        onCleanup(() => order.push(3));
      });
      c();
      s(2);
      c();
      expect(order).toEqual([3, 2, 1]);
    });
  });

  describe("errors", () => {
    it("propagates a throw from the getter and runs registered cleanups", () => {
      const cleanup = vi.fn();
      const c = computed(() => {
        onCleanup(cleanup);
        throw new Error("boom");
      });
      expect(() => c()).toThrow("boom");
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });
});
