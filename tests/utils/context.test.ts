import { describe, it, vi, expect } from "vite-plus/test";
import {
  signal,
  computed,
  effect,
  root,
  createContext,
  getContext,
  setContext,
  getOwner,
  runWithOwner,
  onCleanup,
} from "../../src/index";

describe("context", () => {
  it("returns the default when nothing is provided", () => {
    const Theme = createContext("light");
    root(() => {
      expect(getContext(Theme)).toBe("light");
    });
  });

  it("returns undefined default outside any owner", () => {
    const Theme = createContext<string>();
    expect(getContext(Theme)).toBe(undefined);
  });

  it("reads a provided value from a descendant", () => {
    const Theme = createContext("light");
    let seen: string | undefined;
    root(() => {
      setContext(Theme, "dark");
      effect(() => {
        seen = getContext(Theme);
      });
    });
    expect(seen).toBe("dark");
  });

  it("inherits through computeds and nested effects", () => {
    const Count = createContext(0);
    let viaComputed: number | undefined;
    let viaNested: number | undefined;
    root(() => {
      setContext(Count, 42);
      const c = computed(() => getContext(Count));
      effect(() => {
        viaComputed = c();
        effect(() => {
          viaNested = getContext(Count);
        });
      });
    });
    expect(viaComputed).toBe(42);
    expect(viaNested).toBe(42);
  });

  it("a nested provider overrides without leaking to the parent", () => {
    const Theme = createContext("light");
    let outer: string | undefined;
    let inner: string | undefined;
    root(() => {
      setContext(Theme, "dark");
      effect(() => {
        outer = getContext(Theme);
      });
      root(() => {
        setContext(Theme, "high-contrast");
        effect(() => {
          inner = getContext(Theme);
        });
      });
    });
    expect(outer).toBe("dark"); // parent unaffected by the nested provider
    expect(inner).toBe("high-contrast");
  });

  it("a descendant provider does not bleed up to an earlier sibling", () => {
    const Theme = createContext("light");
    const seen: string[] = [];
    root(() => {
      effect(() => {
        seen.push(`before:${getContext(Theme)}`); // created before provide
      });
      setContext(Theme, "dark");
      effect(() => {
        seen.push(`after:${getContext(Theme)}`); // created after provide
      });
    });
    expect(seen).toEqual(["before:light", "after:dark"]);
  });

  it("re-establishes context on effect re-runs", async () => {
    const Theme = createContext("light");
    const s = signal(0);
    const seen: string[] = [];
    root(() => {
      setContext(Theme, "dark");
      effect(() => {
        s();
        seen.push(getContext(Theme)!);
      });
    });
    s(1);
    await Promise.resolve();
    expect(seen).toEqual(["dark", "dark"]);
  });

  it("can read/write context against a captured owner", () => {
    const Theme = createContext("light");
    let owner: ReturnType<typeof getOwner>;
    root(() => {
      setContext(Theme, "dark");
      owner = getOwner();
    });
    // outside the root, via the captured owner
    expect(getContext(Theme, owner)).toBe("dark");
    runWithOwner(owner, () => {
      expect(getContext(Theme)).toBe("dark");
    });
  });

  it("keeps distinct contexts independent", () => {
    const A = createContext("a0");
    const B = createContext("b0");
    let a: string | undefined;
    let b: string | undefined;
    root(() => {
      setContext(A, "a1");
      effect(() => {
        a = getContext(A);
        b = getContext(B);
      });
    });
    expect(a).toBe("a1");
    expect(b).toBe("b0"); // untouched → default
  });

  it("context and cleanup coexist (cleanup still runs on dispose)", () => {
    const Theme = createContext("light");
    const cleanup = vi.fn();
    const dispose = root(() => {
      setContext(Theme, "dark");
      effect(() => {
        getContext(Theme);
        onCleanup(cleanup);
      });
    });
    expect(cleanup).toHaveBeenCalledTimes(0);
    dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
