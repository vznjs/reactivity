// Ports of alien-signals' own spec tests (tests/effect.spec.ts, effectScope.spec.ts,
// trigger.spec.ts) that go beyond the shared conformance suite — adapted to VZN's
// imperative `onCleanup` and detached `root` (alien's `effect` returns a disposer
// and uses return-based cleanup; its `effectScope` is a linked scope).
import { describe, it, vi, expect } from "vite-plus/test";
import { signal, computed, effect, root, onCleanup, trigger, flushSync } from "../src/index";

describe("nested effect cleanup ordering (alien effect.spec)", () => {
  it("outer re-run: inner cleanup before outer cleanup, before new run", () => {
    const log: string[] = [];
    const a = signal(0);
    root(() => {
      effect(() => {
        a();
        log.push("outer:run");
        effect(() => {
          log.push("inner:run");
          onCleanup(() => log.push("inner:cleanup"));
        });
        onCleanup(() => log.push("outer:cleanup"));
      });
    });
    expect(log).toEqual(["outer:run", "inner:run"]);
    log.length = 0;
    a(1);
    flushSync();
    expect(log).toEqual(["inner:cleanup", "outer:cleanup", "outer:run", "inner:run"]);
  });

  it("dispose: inner cleanup before outer cleanup", () => {
    const log: string[] = [];
    const disposeRoot = root(() => {
      effect(() => {
        effect(() => {
          onCleanup(() => log.push("inner:cleanup"));
        });
        onCleanup(() => log.push("outer:cleanup"));
      });
    });
    log.length = 0;
    disposeRoot();
    expect(log).toEqual(["inner:cleanup", "outer:cleanup"]);
  });

  it("sibling cleanup on dispose: reverse creation (LIFO)", () => {
    const log: string[] = [];
    const disposeRoot = root(() => {
      effect(() => {
        effect(() => onCleanup(() => log.push("inner1:cleanup")));
        effect(() => onCleanup(() => log.push("inner2:cleanup")));
        effect(() => onCleanup(() => log.push("inner3:cleanup")));
        onCleanup(() => log.push("outer:cleanup"));
      });
    });
    log.length = 0;
    disposeRoot();
    expect(log).toEqual(["inner3:cleanup", "inner2:cleanup", "inner1:cleanup", "outer:cleanup"]);
  });

  it("sibling cleanup on outer re-run: reverse creation (LIFO)", () => {
    const log: string[] = [];
    const a = signal(0);
    root(() => {
      effect(() => {
        a();
        effect(() => onCleanup(() => log.push("inner1:cleanup")));
        effect(() => onCleanup(() => log.push("inner2:cleanup")));
        effect(() => onCleanup(() => log.push("inner3:cleanup")));
        onCleanup(() => log.push("outer:cleanup"));
      });
    });
    log.length = 0;
    a(1);
    flushSync();
    expect(log.slice(0, 4)).toEqual([
      "inner3:cleanup",
      "inner2:cleanup",
      "inner1:cleanup",
      "outer:cleanup",
    ]);
  });

  it("three-level nested cleanup on dispose: deepest first (depth-first reverse)", () => {
    const log: string[] = [];
    const disposeRoot = root(() => {
      effect(() => {
        effect(() => {
          effect(() => onCleanup(() => log.push("grandchild:cleanup")));
          onCleanup(() => log.push("child:cleanup"));
        });
        onCleanup(() => log.push("outer:cleanup"));
      });
    });
    disposeRoot();
    expect(log).toEqual(["grandchild:cleanup", "child:cleanup", "outer:cleanup"]);
  });

  it("computed unwatched: child effect cleanups run in reverse creation (LIFO)", () => {
    const log: string[] = [];
    const disposeRoot = root(() => {
      const c = computed(() => {
        effect(() => onCleanup(() => log.push("e1")));
        effect(() => onCleanup(() => log.push("e2")));
        effect(() => onCleanup(() => log.push("e3")));
        return 0;
      });
      effect(() => {
        c();
      });
    });
    log.length = 0;
    disposeRoot();
    expect(log).toEqual(["e3", "e2", "e1"]);
  });

  it("effect created inside a computed: old inner cleanup before new inner setup", () => {
    const a = signal(0);
    const log: string[] = [];
    root(() => {
      const c = computed(() => {
        log.push("computed:eval");
        effect(() => {
          log.push("inner:run");
          onCleanup(() => log.push("inner:cleanup"));
        });
        return a();
      });
      effect(() => {
        c();
      });
    });
    log.length = 0;
    a(1);
    flushSync();
    expect(log).toEqual(["inner:cleanup", "computed:eval", "inner:run"]);
  });
});

describe("scope dispose ordering (alien effectScope.spec, via root)", () => {
  it("scope dispose runs child effect cleanup", () => {
    const log: string[] = [];
    const disposeRoot = root(() => {
      effect(() => {
        onCleanup(() => log.push("inner:cleanup"));
      });
    });
    disposeRoot();
    expect(log).toEqual(["inner:cleanup"]);
  });

  it("scope dispose: sibling effects clean up in reverse creation (LIFO)", () => {
    const log: string[] = [];
    const disposeRoot = root(() => {
      effect(() => onCleanup(() => log.push("e1:cleanup")));
      effect(() => onCleanup(() => log.push("e2:cleanup")));
      effect(() => onCleanup(() => log.push("e3:cleanup")));
    });
    disposeRoot();
    expect(log).toEqual(["e3:cleanup", "e2:cleanup", "e1:cleanup"]);
  });

  it("scope dispose: nested effect cleanup runs depth-first reverse", () => {
    const log: string[] = [];
    const disposeRoot = root(() => {
      effect(() => {
        effect(() => onCleanup(() => log.push("grandchild:cleanup")));
        onCleanup(() => log.push("child:cleanup"));
      });
    });
    disposeRoot();
    expect(log).toEqual(["grandchild:cleanup", "child:cleanup"]);
  });
});

describe("trigger (alien trigger.spec)", () => {
  it("does not throw when triggering with no dependencies", () => {
    expect(() => trigger(() => {})).not.toThrow();
  });

  it("triggers updates for dependent computed signals", () => {
    const arr = signal<number[]>([]);
    const length = computed(() => arr().length);
    expect(length()).toBe(0);
    arr().push(1);
    trigger(arr);
    expect(length()).toBe(1);
  });

  it("triggers updates for the second source signal", () => {
    const src1 = signal<number[]>([]);
    const src2 = signal<number[]>([]);
    const length = computed(() => src2().length);
    expect(length()).toBe(0);
    src2().push(1);
    trigger(() => {
      src1();
      src2();
    });
    expect(length()).toBe(1);
  });

  it("triggers an effect once", () => {
    const src1 = signal<number[]>([]);
    const src2 = signal<number[]>([]);
    const spy = vi.fn();
    root(() => {
      effect(() => {
        spy();
        src1();
        src2();
      });
    });
    expect(spy).toHaveBeenCalledTimes(1);
    trigger(() => {
      src1();
      src2();
    });
    flushSync();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("does not notify the trigger function's own sub", () => {
    const src1 = signal<number[]>([]);
    const src2 = computed(() => src1());
    root(() => {
      effect(() => {
        src1();
        src2();
      });
    });
    expect(() =>
      trigger(() => {
        src1();
        src2();
      }),
    ).not.toThrow();
    flushSync();
  });
});
