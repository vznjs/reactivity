import { describe, it, vi, expect } from "vite-plus/test";
import { signal, trigger, computed, effect, root, onCleanup, flushSync } from "../src/index";
import { untracked } from "../src/index";
import { batch } from "../src/index";

describe("integration / mix-and-match", () => {
  it("models a small derived state graph", async () => {
    const log: string[] = [];
    const firstName = signal("Ada");
    const lastName = signal("Lovelace");
    const fullName = computed(() => `${firstName()} ${lastName()}`);
    const greeting = computed(() => `Hi ${fullName()}!`);

    root(() => {
      effect(() => {
        log.push(greeting());
      });
    });

    expect(log).toEqual(["Hi Ada Lovelace!"]);

    batch(() => {
      firstName("Grace");
      lastName("Hopper");
    });
    flushSync();
    expect(log).toEqual(["Hi Ada Lovelace!", "Hi Grace Hopper!"]);
  });

  it("computed of computed of signal updates an effect exactly once per change", async () => {
    const spy = vi.fn();
    const s = signal(1);
    root(() => {
      const a = computed(() => s() * 2);
      const b = computed(() => a() + 1);
      effect(() => spy(b()));
    });
    expect(spy).toHaveBeenLastCalledWith(3);
    s(2);
    s(3);
    await Promise.resolve();
    expect(spy).toHaveBeenLastCalledWith(7);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("untracked + cleanup compose inside an effect", async () => {
    const log: string[] = [];
    const dep = signal(0);
    const noise = signal(0);

    const disposeRoot = root(() => {
      effect(() => {
        dep(); // tracked dependency
        const snapshot = untracked(() => noise()); // read untracked
        log.push(`run:${snapshot}`);
        onCleanup(() => log.push("cleanup"));
      });
    });

    expect(log).toEqual(["run:0"]);
    noise(5); // read via untracked → not a dependency
    await Promise.resolve();
    expect(log).toEqual(["run:0"]);
    dep(1);
    await Promise.resolve();
    expect(log).toEqual(["run:0", "cleanup", "run:5"]);
    disposeRoot();
    expect(log).toEqual(["run:0", "cleanup", "run:5", "cleanup"]);
  });

  it("nested ownership: disposing the parent disposes everything beneath", async () => {
    const cleanups: string[] = [];
    const s = signal(0);

    const disposeRoot = root(() => {
      effect(() => {
        s();
        onCleanup(() => cleanups.push("outer"));
        effect(() => {
          onCleanup(() => cleanups.push("inner"));
        });
      });
    });

    disposeRoot();
    expect(cleanups).toContain("outer");
    expect(cleanups).toContain("inner");
  });

  it("trigger forces a recompute even when the value is unchanged", () => {
    const getterSpy = vi.fn();
    const s = signal(0);
    const c = computed(() => {
      s();
      getterSpy();
      return "constant";
    });
    expect(c()).toBe("constant");
    expect(getterSpy).toHaveBeenCalledTimes(1);
    trigger(s); // value unchanged, but subscribers are forced to recompute
    expect(c()).toBe("constant");
    expect(getterSpy).toHaveBeenCalledTimes(2);
  });

  it("an effect writing to a signal another effect reads converges", async () => {
    const log: number[] = [];
    const input = signal(1);
    root(() => {
      const doubled = signal(0);
      effect(() => {
        doubled(input() * 2);
      });
      effect(() => {
        log.push(doubled());
      });
    });
    await Promise.resolve();
    input(5);
    await Promise.resolve();
    // effect1 sets doubled=2 before effect2 first reads it; then input=5 → 10
    expect(log).toEqual([2, 10]);
  });

  it("conditional dependencies switch cleanly across types", async () => {
    const spy = vi.fn();
    const useA = signal(true);
    const a = signal("a");
    const b = computed(() => "b");
    root(() => {
      effect(() => {
        spy(useA() ? a() : b());
      });
    });
    expect(spy).toHaveBeenLastCalledWith("a");
    a("a2");
    await Promise.resolve();
    expect(spy).toHaveBeenLastCalledWith("a2");
    useA(false);
    await Promise.resolve();
    expect(spy).toHaveBeenLastCalledWith("b");
    // a is no longer a dependency
    const before = spy.mock.calls.length;
    a("a3");
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(before);
  });

  it("a throwing effect runs its cleanup and does not corrupt later effects", async () => {
    const cleanup = vi.fn();
    const good = vi.fn();
    const s = signal(1);

    expect(() =>
      root(() => {
        effect(() => {
          onCleanup(cleanup);
          throw new Error("boom");
        });
      }),
    ).toThrow("boom");
    expect(cleanup).toHaveBeenCalledTimes(1);

    // a fresh, independent graph still works
    root(() => {
      effect(() => good(s()));
    });
    s(2);
    await Promise.resolve();
    expect(good).toHaveBeenLastCalledWith(2);
  });
});
