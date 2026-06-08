import { describe, it, vi, expect } from "vite-plus/test";
import { signal, computed, effect, root, onCleanup } from "../../src/index";
import { untrack } from "../../src/index";

describe("untrack", () => {
  it("returns the value produced by its function", () => {
    expect(untrack(() => 42)).toBe(42);
  });

  it("reads inside do not create a dependency", async () => {
    const spy = vi.fn();
    const tracked = signal(1);
    const noise = signal(1);
    root(() => {
      effect(() => {
        tracked();
        untrack(() => noise());
        spy();
      });
    });
    expect(spy).toHaveBeenCalledTimes(1);
    noise(2);
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(1);
    tracked(2);
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("still reads the current value", () => {
    const s = signal(7);
    let read: number | undefined;
    root(() => {
      effect(() => {
        read = untrack(() => s());
      });
    });
    expect(read).toBe(7);
  });

  it("restores tracking after it returns", async () => {
    const spy = vi.fn();
    const a = signal(1);
    const b = signal(1);
    root(() => {
      effect(() => {
        untrack(() => a());
        b();
        spy();
      });
    });
    b(2);
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("nests correctly", async () => {
    const spy = vi.fn();
    const a = signal(1);
    const b = signal(1);
    root(() => {
      effect(() => {
        untrack(() => {
          a();
          untrack(() => b());
        });
        spy();
      });
    });
    a(2);
    b(2);
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("does not track a computed read inside it", () => {
    const s = signal(1);
    const c = computed(() => s());
    let value: number | undefined;
    root(() => {
      effect(() => {
        value = untrack(() => c());
      });
    });
    expect(value).toBe(1);
  });

  it("onCleanup inside untrack still registers", () => {
    const cleanup = vi.fn();
    const disposeRoot = root(() => {
      effect(() => {
        untrack(() => onCleanup(cleanup));
      });
    });
    disposeRoot();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
