import { describe, it, vi, expect } from "vite-plus/test";
import { signal, trigger, computed, effect, root, onCleanup, flushSync } from "../../src/index";
import { batch } from "../../src/index";

describe("effect", () => {
  describe("running", () => {
    it("runs once immediately on creation", () => {
      const spy = vi.fn();
      root(() => effect(spy));
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("re-runs on the microtask after a dependency changes", async () => {
      const spy = vi.fn();
      const s = signal(1);
      root(() => effect(() => spy(s())));
      expect(spy).toHaveBeenLastCalledWith(1);
      s(2);
      // not yet — async
      expect(spy).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      expect(spy).toHaveBeenLastCalledWith(2);
    });

    it("batches multiple synchronous writes into a single re-run", async () => {
      const spy = vi.fn();
      const a = signal(1);
      const b = signal(1);
      root(() => effect(() => spy(a() + b())));
      a(2);
      b(2);
      a(3);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith(5);
    });

    it("reads see the latest value synchronously even before the flush", () => {
      const s = signal("a");
      root(() => {
        effect(() => {
          s();
        });
      });
      s("b");
      expect(s()).toBe("b");
    });
  });

  describe("returned teardown (React/alien style)", () => {
    it("runs a returned teardown before each re-run and on disposal", async () => {
      const teardown = vi.fn();
      const s = signal(1);
      const disposeRoot = root(() => {
        effect(() => {
          s();
          return teardown;
        });
      });
      expect(teardown).toHaveBeenCalledTimes(0);
      s(2);
      await Promise.resolve();
      expect(teardown).toHaveBeenCalledTimes(1); // before the re-run
      disposeRoot();
      expect(teardown).toHaveBeenCalledTimes(2); // on dispose
    });

    it("runs both onCleanup and the returned teardown (LIFO: return first)", async () => {
      const order: string[] = [];
      const s = signal(1);
      root(() => {
        effect(() => {
          s();
          onCleanup(() => order.push("onCleanup"));
          return () => order.push("returned");
        });
      });
      s(2);
      await Promise.resolve();
      // registered last (after the body) → runs first
      expect(order).toEqual(["returned", "onCleanup"]);
    });

    it("ignores a non-function (void) return", () => {
      const s = signal(1);
      expect(() =>
        root(() => {
          effect(() => {
            s();
          });
        }),
      ).not.toThrow();
    });
  });

  describe("cleanups", () => {
    it("runs cleanups before each re-run and on disposal (LIFO)", async () => {
      const order: string[] = [];
      const s = signal(1);
      const disposeRoot = root(() => {
        effect(() => {
          s();
          onCleanup(() => order.push("a"));
          onCleanup(() => order.push("b"));
        });
      });
      expect(order).toEqual([]);
      s(2);
      await Promise.resolve();
      expect(order).toEqual(["b", "a"]);
      disposeRoot();
      expect(order).toEqual(["b", "a", "b", "a"]);
    });

    it("returns a disposer that stops the effect and runs its cleanups", async () => {
      const cleanup = vi.fn();
      const s = signal(1);
      let dispose: () => void = () => {};
      root(() => {
        dispose = effect(() => {
          s();
          onCleanup(cleanup);
        });
      });
      expect(cleanup).toHaveBeenCalledTimes(0);
      dispose();
      expect(cleanup).toHaveBeenCalledTimes(1);
      s(2);
      await Promise.resolve();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("disposer works for a top-level (un-rooted) effect", async () => {
      const spy = vi.fn();
      const s = signal(0);
      const dispose = effect(() => spy(s()));
      expect(spy).toHaveBeenCalledTimes(1);
      dispose();
      s(1);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("does not re-run after disposal", async () => {
      const spy = vi.fn();
      const s = signal(1);
      const disposeRoot = root(() => {
        effect(() => spy(s()));
      });
      disposeRoot();
      s(2);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("runs cleanups registered before a synchronous throw on the first run", () => {
      const cleanup = vi.fn();
      expect(() =>
        root(() => {
          effect(() => {
            onCleanup(cleanup);
            throw new Error("boom");
          });
        }),
      ).toThrow("boom");
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe("nested effects", () => {
    it("disposes child effects when the parent re-runs (unrelated deps)", async () => {
      const calls: string[] = [];
      const a = signal(true);
      const b = signal(true);
      root(() => {
        effect(() => {
          calls.push("upper");
          if (!a()) return;
          effect(() => {
            b();
            calls.push("sub");
          });
        });
      });
      expect(calls).toEqual(["upper", "sub"]);
      b(false);
      a(false);
      await Promise.resolve();
      // parent re-ran (disposing the child), child did not re-run for b
      expect(calls).toEqual(["upper", "sub", "upper"]);
    });

    it("recreates child effects when the parent re-runs (related dep)", async () => {
      const spy = vi.fn();
      const s = signal(false);
      root(() => {
        effect(() => {
          if (!s()) return;
          effect(() => spy(s()));
        });
      });
      expect(spy).toHaveBeenCalledTimes(0);
      s(true);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(1);
      s(false);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("runs child cleanups when the parent re-runs", async () => {
      const cleanup = vi.fn();
      const a = signal(0);
      root(() => {
        effect(() => {
          a();
          effect(() => {
            onCleanup(cleanup);
          });
        });
      });
      expect(cleanup).toHaveBeenCalledTimes(0);
      a(1);
      await Promise.resolve();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });
  });

  describe("cross-updates & glitch-freedom", () => {
    it("propagates a write made inside an effect", async () => {
      const spy = vi.fn();
      const a = signal(2);
      const b = signal(2);
      root(() => {
        effect(() => spy(b()));
        effect(() => b(a() + 1));
      });
      expect(spy).toHaveBeenCalledTimes(1);
      await Promise.resolve();
      expect(spy).toHaveBeenLastCalledWith(3);
      a(5);
      await Promise.resolve();
      expect(spy).toHaveBeenLastCalledWith(6);
    });

    it("settles a self-referential update without looping (subclocks)", async () => {
      const spy = vi.fn();
      const s = signal(20);
      root(() => {
        effect(() => {
          while (s() <= 10) s(s() + 1);
        });
        effect(() => spy(s()));
      });
      expect(spy).toHaveBeenCalledTimes(1);
      s(5);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(2);
      expect(s()).toBe(11);
    });

    it("a reaction that writes the value it reads does not loop", async () => {
      const spy = vi.fn();
      const s = signal(0);
      root(() => {
        effect(() => {
          spy();
          s(s() + 1);
        });
      });
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(1);
      expect(s()).toBe(1);
    });
  });

  describe("interaction with batch/directSignal/computed", () => {
    it("a batch defers and coalesces the effect", () => {
      const spy = vi.fn();
      const s = signal(1);
      root(() => effect(() => spy(s())));
      batch(() => {
        s(2);
        s(3);
      });
      expect(spy).toHaveBeenCalledTimes(2);
      expect(spy).toHaveBeenLastCalledWith(3);
    });

    it("flushSync runs a pending effect immediately", () => {
      const spy = vi.fn();
      const s = signal(1);
      root(() => effect(() => spy(s())));
      s(2);
      flushSync();
      expect(spy).toHaveBeenLastCalledWith(2);
    });

    it("re-runs when a dependency is triggered (value unchanged)", async () => {
      const spy = vi.fn();
      const s = signal(1);
      root(() => effect(() => spy(s())));
      trigger(s);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(2);
    });

    it("re-runs through a chain signal → computed → effect", async () => {
      const spy = vi.fn();
      const s = signal(1);
      root(() => {
        const c = computed(() => s() + 1);
        effect(() => spy(c()));
      });
      s(2);
      await Promise.resolve();
      expect(spy).toHaveBeenLastCalledWith(3);
    });
  });

  describe("un-rooted auto-dispose", () => {
    it("keeps reacting across microtasks then disposes on the next macrotask", async () => {
      const spy = vi.fn();
      const s = signal(0);
      effect(() => spy(s()));
      s(1);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(2);
      await new Promise((r) => setTimeout(r, 0));
      s(2);
      await Promise.resolve();
      expect(spy).toHaveBeenCalledTimes(2);
    });
  });
});
