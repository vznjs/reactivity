import { describe, it, vi, expect } from "vite-plus/test";
import { signal, effect, root, flushSync } from "../../src/index";
import { batch } from "../../src/index";

describe("scheduler", () => {
  describe("async batching (default)", () => {
    it("defers effects to the microtask and coalesces", async () => {
      const spy = vi.fn();
      const s = signal(0);
      root(() => effect(() => spy(s())));
      s(1);
      s(2);
      expect(spy).toHaveBeenCalledTimes(1); // not yet
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith(2);
    });

    it("only schedules one microtask for many writes", async () => {
      const spy = vi.fn();
      const s = signal(0);
      root(() => effect(() => spy(s())));
      for (let i = 1; i <= 10; i++) s(i);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe("batch", () => {
    it("defers effects until the batch ends", () => {
      const spy = vi.fn();
      const s = signal(0);
      root(() => effect(() => spy(s())));
      batch(() => {
        s(1);
        s(2);
        expect(spy).toHaveBeenCalledTimes(1);
      });
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("returns the callback result", () => {
      expect(batch(() => 5)).toBe(5);
    });

    it("nested batches flush only at the outermost end", () => {
      const spy = vi.fn();
      const s = signal(0);
      root(() => effect(() => spy(s())));
      batch(() => {
        s(1);
        batch(() => {
          s(2);
        });
        expect(spy).toHaveBeenCalledTimes(1);
      });
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("ends the batch even if the callback throws", () => {
      const spy = vi.fn();
      const s = signal(0);
      root(() => effect(() => spy(s())));
      expect(() =>
        batch(() => {
          s(1);
          throw new Error("boom");
        }),
      ).toThrow("boom");
      // batch closed → the write flushed
      expect(spy).toHaveBeenLastCalledWith(1);
    });
  });

  describe("flushSync", () => {
    it("drains pending effects immediately", () => {
      const spy = vi.fn();
      const s = signal(0);
      root(() => effect(() => spy(s())));
      s(1);
      expect(spy).toHaveBeenCalledTimes(1);
      flushSync();
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("is a no-op when nothing is scheduled", () => {
      expect(() => flushSync()).not.toThrow();
    });

    it("is a no-op inside an open batch (the batch flushes at its boundary)", () => {
      const spy = vi.fn();
      const s = signal(0);
      root(() => effect(() => spy(s())));
      batch(() => {
        s(1);
        flushSync();
        expect(spy).toHaveBeenCalledTimes(1);
      });
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("a subsequent microtask flush after flushSync is harmless", async () => {
      const spy = vi.fn();
      const s = signal(0);
      root(() => effect(() => spy(s())));
      s(1);
      flushSync();
      expect(spy).toHaveBeenCalledTimes(2);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });

  describe("flushSync(fn) — scoped synchronous scheduler", () => {
    it("settles each write immediately (per-write, not deferred to the end)", () => {
      const spy = vi.fn();
      const s = signal(0);
      root(() => effect(() => spy(s())));
      expect(spy).toHaveBeenCalledTimes(1);
      flushSync(() => {
        s(1);
        expect(spy).toHaveBeenCalledTimes(2); // settled immediately
        s(2);
        expect(spy).toHaveBeenCalledTimes(3); // settled again
      });
      expect(spy).toHaveBeenLastCalledWith(2);
    });

    it("returns fn's result", () => {
      expect(flushSync(() => 42)).toBe(42);
    });

    it("defers to the outer boundary when nested in a batch", () => {
      const spy = vi.fn();
      const s = signal(0);
      root(() => effect(() => spy(s())));
      batch(() => {
        flushSync(() => s(1));
        // outer batch still open → no flush yet
        expect(spy).toHaveBeenCalledTimes(1);
      });
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});
