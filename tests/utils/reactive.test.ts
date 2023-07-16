import { describe, it, vi, expect } from "vitest";
import { createDisposer, flushDisposer } from "../../src/core/disposer";
import { reactive } from "../../src/utils/reactive";
import { createOwner, runWithOwner } from "../../src/core/owner";
import { createValue } from "../../src/state/value";
import { onCleanup } from "../../src/utils/on-cleanup";

describe("reactive", () => {
  const [getAtom, setAtom] = createValue(1);
  it("reruns and cleanups on change", async () => {
    const disposerId = createDisposer();
    const reactionSpy = vi.fn();
    const cleanupSpy = vi.fn();

    runWithOwner(createOwner({ disposerId, reactionId: undefined }), () => {
      reactive(() => {
        onCleanup(cleanupSpy);
        reactionSpy();
        getAtom();
      });
    });

    expect(reactionSpy.mock.calls.length).toBe(1);
    expect(cleanupSpy.mock.calls.length).toBe(0);

    setAtom(2);
    await Promise.resolve();

    expect(reactionSpy.mock.calls.length).toBe(2);
    expect(cleanupSpy.mock.calls.length).toBe(1);

    setAtom(3);
    await Promise.resolve();

    expect(reactionSpy.mock.calls.length).toBe(3);
    expect(cleanupSpy.mock.calls.length).toBe(2);

    flushDisposer(disposerId);

    expect(reactionSpy.mock.calls.length).toBe(3);
    expect(cleanupSpy.mock.calls.length).toBe(3);

    setAtom(4);
    await Promise.resolve();

    expect(reactionSpy.mock.calls.length).toBe(3);
    expect(cleanupSpy.mock.calls.length).toBe(3);
  });

  it("works with built-in async batching", async () => {
    const [getAtom, setAtom] = createValue("start");

    reactive(() => {
      setAtom("reaction");
      getAtom();
    });

    expect(getAtom()).toBe("reaction");

    setAtom("order");

    expect(getAtom()).toBe("order");

    await Promise.resolve();

    expect(getAtom()).toBe("reaction");
  });

  it("is batching updates", async () => {
    const [getAtom, setAtom] = createValue("start");
    const spy = vi.fn();

    reactive(() => {
      setAtom("reaction1");
      setAtom("reaction2");
      getAtom();
      spy();
    });

    expect(spy.mock.calls.length).toBe(1);

    expect(getAtom()).toBe("reaction2");

    setAtom("order");

    expect(getAtom()).toBe("order");

    await Promise.resolve();

    expect(getAtom()).toBe("reaction2");
    expect(spy.mock.calls.length).toBe(2);
  });

  it("works with nested unrelated reactions", async () => {
    const spy = vi.fn();
    const [getAtom1, setAtom1] = createValue(true);
    const [getAtom2, setAtom2] = createValue(true);

    reactive(() => {
      spy("upper");

      if (!getAtom1()) return;

      reactive(() => {
        getAtom2();
        spy("sub");
      });
    });

    expect(spy.mock.calls).toEqual([["upper"], ["sub"]]);

    setAtom2(false);
    setAtom1(false);

    await Promise.resolve();

    expect(spy.mock.calls).toEqual([["upper"], ["sub"], ["upper"]]);
  });

  it("works with nested related reactions", async () => {
    const spy = vi.fn();
    const [getAtom, setAtom] = createValue(false);

    reactive(() => {
      if (!getAtom()) return;
      reactive(() => spy(getAtom()));
    });

    expect(spy.mock.calls.length).toBe(0);

    setAtom(true);

    await Promise.resolve();

    expect(spy.mock.calls.length).toBe(1);

    setAtom(false);

    await Promise.resolve();

    expect(spy.mock.calls.length).toBe(1);
  });

  it("does not run scheduled reaction after context cleanup", async () => {
    const cleanupSpy = vi.fn();
    const reactionSpy = vi.fn();
    const disposerId = createDisposer();
    const [getAtom, setAtom] = createValue(false);

    runWithOwner(createOwner({ disposerId, reactionId: undefined }), () => {
      reactive(() => {
        getAtom();
        reactionSpy();
        onCleanup(cleanupSpy);
      });
    });

    expect(cleanupSpy.mock.calls.length).toBe(0);
    expect(reactionSpy.mock.calls.length).toBe(1);

    setAtom(true);

    expect(cleanupSpy.mock.calls.length).toBe(0);
    expect(reactionSpy.mock.calls.length).toBe(1);

    flushDisposer(disposerId);

    expect(cleanupSpy.mock.calls.length).toBe(1);

    await Promise.resolve();

    expect(reactionSpy.mock.calls.length).toBe(1);
  });
});
