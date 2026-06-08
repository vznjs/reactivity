import { describe, it, vi, expect } from "vite-plus/test";
import { root, onCleanup, getOwner, runWithOwner } from "../../src/index";

describe("getOwner / runWithOwner", () => {
  it("getOwner returns undefined at the top level", () => {
    expect(getOwner()).toBe(undefined);
  });

  it("getOwner returns the active owner inside a root", () => {
    root(() => {
      expect(getOwner()).not.toBe(undefined);
    });
  });

  it("runWithOwner registers an onCleanup against a captured owner", () => {
    const cleanup = vi.fn();
    const disposeRoot = root(() => {
      const owner = getOwner();
      // register from "outside" the owner
      runWithOwner(owner, () => onCleanup(cleanup));
    });
    expect(cleanup).toHaveBeenCalledTimes(0);
    disposeRoot();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});
