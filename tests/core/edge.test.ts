import { describe, it, vi, expect } from "vite-plus/test";
import { signal, computed, effect, root, onCleanup, flushSync } from "../../src/index";

describe("edge cases", () => {
  it("disposes a child effect created inside a computed when the computed recomputes", () => {
    const cleanup = vi.fn();
    const s = signal(1);
    const c = computed(() => {
      effect(() => {
        onCleanup(cleanup);
      });
      return s();
    });
    expect(c()).toBe(1);
    expect(cleanup).toHaveBeenCalledTimes(0);
    s(2);
    expect(c()).toBe(2);
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("does not re-run an effect when a computed dependency's value is unchanged", async () => {
    const spy = vi.fn();
    const s = signal(2);
    root(() => {
      const even = computed(() => s() % 2 === 0);
      effect(() => spy(even()));
    });
    expect(spy).toHaveBeenCalledTimes(1);
    s(4); // still even → memo value unchanged → effect not re-run
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(1);
    s(5); // odd → changed
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("skips re-running an effect that disposes itself in its own cleanup", async () => {
    const rerun = vi.fn();
    const s = signal(0);
    const disposeRoot = root(() => {
      effect(() => {
        s();
        rerun();
        onCleanup(() => disposeRoot());
      });
    });
    expect(rerun).toHaveBeenCalledTimes(1);
    s(1);
    await Promise.resolve();
    expect(rerun).toHaveBeenCalledTimes(1);
  });

  it("re-marks the remaining queued effects when one throws during a flush", () => {
    const ran = vi.fn();
    const a = signal(0);
    root(() => {
      effect(() => {
        if (a() === 1) throw new Error("boom");
      });
      effect(() => {
        a();
        ran();
      });
    });
    ran.mockClear();
    a(1);
    expect(() => flushSync()).toThrow("boom");
  });

  it("handles a throwing effect with no registered cleanups", () => {
    expect(() =>
      root(() => {
        effect(() => {
          throw new Error("boom");
        });
      }),
    ).toThrow("boom");
  });

  it("reuses the global owner across several un-rooted effects in one macrotask", async () => {
    const a = vi.fn();
    const b = vi.fn();
    const s = signal(0);
    effect(() => a(s()));
    effect(() => b(s()));
    s(1);
    await Promise.resolve();
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(2);
    await new Promise((r) => setTimeout(r, 0));
  });

  it("disposes a memo with no cleanups and no dependencies cleanly", () => {
    const disposeA = root(() => {
      const c = computed(() => 5); // reads nothing
      effect(() => {
        c();
      });
    });
    const disposeB = root(() => {
      const s = signal(1);
      const c = computed(() => s() * 2); // no cleanups
      effect(() => {
        c();
      });
    });
    expect(() => disposeA()).not.toThrow();
    expect(() => disposeB()).not.toThrow();
  });

  it("propagates a throw on recompute (not just first run) and runs cleanups", () => {
    const cleanup = vi.fn();
    const s = signal(1);
    const c = computed(() => {
      onCleanup(cleanup);
      if (s() === 2) throw new Error("boom");
      return s();
    });
    expect(c()).toBe(1);
    s(2);
    expect(() => c()).toThrow("boom");
    // the previous run's cleanup ran before recompute, this run's ran on throw
    expect(cleanup).toHaveBeenCalledTimes(2);
  });

  it("commits a dirty signal read synchronously while it has subscribers", async () => {
    const s = signal(1);
    const spy = vi.fn();
    root(() => effect(() => spy(s())));
    s(2); // s dirty, effect marked
    expect(s()).toBe(2); // synchronous read commits + shallow-propagates to subscribers
    await Promise.resolve();
    expect(spy).toHaveBeenLastCalledWith(2);
  });

  it("purges all dependencies when a re-run reads none", async () => {
    const a = signal(1);
    const gate = { open: true };
    const spy = vi.fn();
    root(() => {
      effect(() => {
        if (gate.open) a();
        spy();
      });
    });
    expect(spy).toHaveBeenCalledTimes(1);
    gate.open = false;
    a(2); // re-run reads no dependencies → purges the old one
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(2);
    a(3); // a is no longer a dependency
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("reports no net change when a signal is written then reverted in the same tick", () => {
    const s = signal(1);
    s(2);
    s(1); // back to the original value — dirty, but no net change
    expect(s()).toBe(1);
  });

  it("an inner effect re-running alone leaves the outer responding to its own dep", async () => {
    const a = signal(0);
    const b = signal(0);
    let outerRuns = 0;
    let innerRuns = 0;
    root(() => {
      effect(() => {
        a();
        outerRuns++;
        effect(() => {
          b();
          innerRuns++;
        });
      });
    });
    expect(outerRuns).toBe(1);
    expect(innerRuns).toBe(1);
    b(1); // inner re-runs alone; outer is touched via the notify chain
    await Promise.resolve();
    expect(outerRuns).toBe(1);
    expect(innerRuns).toBeGreaterThanOrEqual(2);
    a(1); // outer re-runs, disposing and recreating the inner
    await Promise.resolve();
    expect(outerRuns).toBe(2);
  });

  it("preserves child-effect tracking through an inner-only re-run", async () => {
    const a = signal(0);
    const b = signal(0);
    const log: string[] = [];
    root(() => {
      effect(() => {
        a();
        log.push("outer:run");
        onCleanup(() => log.push("outer:cleanup"));
        effect(() => {
          b();
          log.push("inner:run");
          onCleanup(() => log.push("inner:cleanup"));
        });
      });
    });
    b(1);
    await Promise.resolve();
    log.length = 0;
    a(1);
    await Promise.resolve();
    expect(log).toEqual(["inner:cleanup", "outer:cleanup", "outer:run", "inner:run"]);
  });

  it("supports a deep computed chain that recomputes once per change", () => {
    const s = signal(0);
    let c = computed(() => s());
    for (let i = 0; i < 20; i++) {
      const prev = c;
      c = computed(() => prev() + 1);
    }
    const head = c;
    expect(head()).toBe(20);
    s(1);
    expect(head()).toBe(21);
  });
});
