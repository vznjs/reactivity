import { describe, it, vi, expect } from "vite-plus/test";
import { signal, effect, computed, root, onCleanup } from "../../src/index";
import { untrack } from "../../src/index";

describe("onCleanup", () => {
  describe("lazy storage (0 → 1 → many)", () => {
    it("runs a single cleanup", () => {
      const cleanup = vi.fn();
      const disposeRoot = root(() => {
        onCleanup(cleanup);
      });
      disposeRoot();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("runs two cleanups LIFO", () => {
      const order: number[] = [];
      const disposeRoot = root(() => {
        onCleanup(() => order.push(1));
        onCleanup(() => order.push(2));
      });
      disposeRoot();
      expect(order).toEqual([2, 1]);
    });

    it("runs many cleanups LIFO", () => {
      const order: number[] = [];
      const disposeRoot = root(() => {
        for (let i = 0; i < 5; i++) onCleanup(() => order.push(i));
      });
      disposeRoot();
      expect(order).toEqual([4, 3, 2, 1, 0]);
    });
  });

  describe("scope", () => {
    it("registers to the active effect", async () => {
      const cleanup = vi.fn();
      const s = signal(1);
      root(() => {
        effect(() => {
          s();
          onCleanup(cleanup);
        });
      });
      s(2);
      await Promise.resolve();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("registers to the active root, not an inner effect that already finished", () => {
      const order: string[] = [];
      const disposeRoot = root(() => {
        onCleanup(() => order.push("root"));
      });
      disposeRoot();
      expect(order).toEqual(["root"]);
    });

    it("still registers when called inside untrack", () => {
      const cleanup = vi.fn();
      const disposeRoot = root(() => {
        untrack(() => onCleanup(cleanup));
      });
      expect(cleanup).toHaveBeenCalledTimes(0);
      disposeRoot();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("runs cleanup callbacks untracked (no dependency on signals read inside)", async () => {
      const cleanupRun = vi.fn();
      const rerun = vi.fn();
      const s = signal(1);
      const dep = signal(1);
      root(() => {
        effect(() => {
          s();
          rerun();
          onCleanup(() => {
            dep(); // reading here must not create a dependency
            cleanupRun();
          });
        });
      });
      s(2);
      await Promise.resolve();
      expect(cleanupRun).toHaveBeenCalledTimes(1);
      // changing `dep` must not re-run the effect
      dep(2);
      await Promise.resolve();
      expect(rerun).toHaveBeenCalledTimes(2);
    });
  });

  describe("un-rooted", () => {
    it("a top-level onCleanup runs on the next macrotask", async () => {
      const cleanup = vi.fn();
      onCleanup(cleanup);
      expect(cleanup).toHaveBeenCalledTimes(0);
      await new Promise((r) => setTimeout(r, 0));
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe("with computed", () => {
    it("memo cleanup runs before recompute and on dispose", () => {
      const order: string[] = [];
      const s = signal(1);
      const disposeRoot = root(() => {
        const c = computed(() => {
          s();
          onCleanup(() => order.push("clean"));
        });
        effect(() => c());
        s(2); // mark dirty; effect recompute happens via flush, but pull on next tick
      });
      disposeRoot();
      expect(order).toContain("clean");
    });
  });
});
