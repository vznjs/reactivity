import { describe, it, vi, expect } from "vite-plus/test";
import { signal, effect, computed, root, onCleanup } from "../../src/index";

describe("root", () => {
  it("returns a dispose function", () => {
    const dispose = root(() => {});
    expect(typeof dispose).toBe("function");
  });

  it("disposes child effects on dispose", async () => {
    const spy = vi.fn();
    const s = signal(1);
    const disposeRoot = root(() => {
      effect(() => spy(s()));
    });
    s(2);
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(2);
    disposeRoot();
    s(3);
    await Promise.resolve();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("runs root-level cleanups on dispose", () => {
    const cleanup = vi.fn();
    const disposeRoot = root(() => {
      onCleanup(cleanup);
    });
    expect(cleanup).toHaveBeenCalledTimes(0);
    disposeRoot();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("dispose is idempotent", () => {
    const cleanup = vi.fn();
    const disposeRoot = root(() => {
      onCleanup(cleanup);
    });
    disposeRoot();
    disposeRoot();
    disposeRoot();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("runs cleanups registered before a throw during setup", () => {
    const cleanup = vi.fn();
    expect(() =>
      root(() => {
        onCleanup(cleanup);
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it("escapes its parent: a nested root survives the parent re-running", async () => {
    const outerSpy = vi.fn();
    const innerSpy = vi.fn();
    const outer = signal(0);
    const inner = signal(0);
    root(() => {
      effect(() => {
        outer();
        outerSpy();
        root(() => {
          effect(() => {
            inner();
            innerSpy();
          });
        });
      });
    });
    expect(outerSpy).toHaveBeenCalledTimes(1);
    expect(innerSpy).toHaveBeenCalledTimes(1);
    outer(1);
    outer(2);
    await Promise.resolve();
    expect(outerSpy).toHaveBeenCalledTimes(2);
    expect(innerSpy).toHaveBeenCalledTimes(2);
    // both inner roots (from each outer run) are still alive
    inner(1);
    await Promise.resolve();
    expect(innerSpy).toHaveBeenCalledTimes(4);
  });

  it("supports nested roots disposed independently", async () => {
    const aSpy = vi.fn();
    const bSpy = vi.fn();
    const s = signal(0);
    let disposeA: () => void = () => {};
    let disposeB: () => void = () => {};
    root(() => {
      disposeA = root(() => {
        effect(() => aSpy(s()));
      });
      disposeB = root(() => {
        effect(() => bSpy(s()));
      });
    });
    disposeA();
    s(1);
    await Promise.resolve();
    expect(aSpy).toHaveBeenCalledTimes(1);
    expect(bSpy).toHaveBeenCalledTimes(2);
    disposeB();
    s(2);
    await Promise.resolve();
    expect(bSpy).toHaveBeenCalledTimes(2);
  });

  it("disposes a computed used only inside it when disposed", () => {
    const cleanup = vi.fn();
    const s = signal(1);
    const disposeRoot = root(() => {
      const c = computed(() => {
        s();
        onCleanup(cleanup);
      });
      effect(() => {
        c();
      });
    });
    disposeRoot();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
