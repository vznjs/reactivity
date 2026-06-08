import { describe, it, vi, expect } from "vite-plus/test";
import { signal, trigger, computed, effect, root, batch } from "../../src/index";

describe("signal", () => {
  describe("value", () => {
    it("returns undefined with no initial value", () => {
      const s = signal<number>();
      expect(s()).toBe(undefined);
    });

    it("returns the initial value", () => {
      expect(signal(1)()).toBe(1);
      expect(signal("x")()).toBe("x");
      expect(signal(null)()).toBe(null);
      expect(signal(false)()).toBe(false);
      const obj = {};
      expect(signal(obj)()).toBe(obj);
    });

    it("updates synchronously on write (read sees new value immediately)", () => {
      const s = signal(1);
      s(2);
      expect(s()).toBe(2);
      s(3);
      expect(s()).toBe(3);
    });

    it("can be set to undefined", () => {
      const s = signal<number | undefined>(1);
      s(undefined);
      expect(s()).toBe(undefined);
    });

    it("can be set to falsy values", () => {
      const s = signal<unknown>(1);
      s(0);
      expect(s()).toBe(0);
      s("");
      expect(s()).toBe("");
      s(null);
      expect(s()).toBe(null);
    });
  });

  describe("equality (notifies only on change)", () => {
    it("does not notify when set to a strictly-equal value", async () => {
      const spy = vi.fn();
      root(() => {
        const s = signal(1);
        effect(() => {
          s();
          spy();
        });
        expect(spy).toHaveBeenCalledTimes(1);
        s(1);
      });
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("notifies when set to a different value", async () => {
      const spy = vi.fn();
      const s = signal(1);
      root(() => {
        effect(() => {
          s();
          spy();
        });
      });
      s(2);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("treats NaN as changed (NaN !== NaN)", async () => {
      const spy = vi.fn();
      const s = signal<number>(NaN);
      root(() => {
        effect(() => {
          s();
          spy();
        });
      });
      s(NaN);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("treats objects by reference", async () => {
      const spy = vi.fn();
      const a = { v: 1 };
      const s = signal(a);
      root(() => {
        effect(() => {
          s();
          spy();
        });
      });
      s(a);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(1);
      s({ v: 1 });
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("does not schedule when there are no subscribers", async () => {
      const s = signal(1);
      s(2);
      s(3);
      await Promise.resolve();
      expect(s()).toBe(3);
    });
  });

  describe("tracking", () => {
    it("reads outside a computation do not track", async () => {
      const spy = vi.fn();
      const s = signal(1);
      // read before any effect — no tracking
      expect(s()).toBe(1);
      root(() => {
        effect(() => spy());
      });
      s(2);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("tracks each distinct signal read in an effect", async () => {
      const spy = vi.fn();
      const a = signal(1);
      const b = signal(1);
      root(() => {
        effect(() => {
          a();
          b();
          spy();
        });
      });
      a(2);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(2);
      b(2);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it("reading the same signal twice tracks it once", async () => {
      const spy = vi.fn();
      const s = signal(1);
      root(() => {
        effect(() => {
          s();
          s();
          spy();
        });
      });
      s(2);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("supports many subscribers", async () => {
      const s = signal(0);
      const calls: number[] = [];
      root(() => {
        for (let i = 0; i < 5; i++) {
          effect(() => {
            s();
            calls.push(i);
          });
        }
      });
      calls.length = 0;
      s(1);
      await Promise.resolve();
      expect(calls.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    });
  });
});

describe("trigger", () => {
  it("re-runs subscribers without changing the value", async () => {
    const spy = vi.fn();
    const s = signal(1);
    root(() => {
      effect(() => {
        s();
        spy();
      });
    });
    expect(spy).toHaveBeenCalledTimes(1);
    trigger(s);
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(s()).toBe(1);
  });

  it("forces a refresh after an in-place mutation (reference unchanged)", async () => {
    const list = signal<number[]>([]);
    const seen: number[] = [];
    root(() => {
      effect(() => {
        seen.push(list().length);
      });
    });
    list().push(1);
    trigger(list);
    await Promise.resolve();
    expect(seen).toEqual([0, 1]);
  });

  it("invalidates several signals at once", async () => {
    const spy = vi.fn();
    const a = signal(1);
    const b = signal(1);
    root(() => {
      effect(() => {
        a();
        spy("a");
      });
      effect(() => {
        b();
        spy("b");
      });
    });
    spy.mockClear();
    trigger(() => {
      a();
      b();
    });
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("is a no-op for a signal with no subscribers", async () => {
    const s = signal(1);
    expect(() => trigger(s)).not.toThrow();
    await Promise.resolve();
    expect(s()).toBe(1);
  });

  it("re-runs a computed's getter even though the value is unchanged", () => {
    const getterSpy = vi.fn();
    const s = signal(1);
    const c = computed(() => {
      s();
      getterSpy();
      return "constant";
    });
    expect(c()).toBe("constant");
    expect(getterSpy).toHaveBeenCalledTimes(1);
    trigger(s);
    expect(c()).toBe("constant");
    expect(getterSpy).toHaveBeenCalledTimes(2);
  });

  it("defers to the batch boundary", () => {
    const spy = vi.fn();
    const s = signal(1);
    root(() => effect(() => spy(s())));
    batch(() => {
      trigger(s);
      expect(spy).toHaveBeenCalledTimes(1);
    });
    expect(spy).toHaveBeenCalledTimes(2);
  });
});
