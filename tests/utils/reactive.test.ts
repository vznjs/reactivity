import { describe, it, vi, expect } from "vitest";
import {
  createDisposer,
  flushDisposer,
  onCleanup,
} from "../../src/core/disposer";
import { reactive } from "../../src/utils/reactive";
import { runWithOwner } from "../../src/core/owner";
import { createValue } from "../../src/reactive/value";

vi.useFakeTimers();

describe("reactive", () => {
  it("reruns and cleanups on change", () => {
    const [getAtom, setAtom] = createValue(1);
    const disposerId = createDisposer();
    const reactionSpy = vi.fn();
    const cleanupSpy = vi.fn();

    runWithOwner({ disposerId, reactionId: undefined }, () => {
      reactive(() => {
        onCleanup(cleanupSpy);
        reactionSpy();
        getAtom();
      });
    });

    expect(reactionSpy.mock.calls.length).toBe(1);
    expect(cleanupSpy.mock.calls.length).toBe(0);

    setAtom(2);
    vi.runAllTimers();

    expect(reactionSpy.mock.calls.length).toBe(2);
    expect(cleanupSpy.mock.calls.length).toBe(1);

    setAtom(3);
    vi.runAllTimers();

    expect(reactionSpy.mock.calls.length).toBe(3);
    expect(cleanupSpy.mock.calls.length).toBe(2);

    flushDisposer(disposerId);

    expect(reactionSpy.mock.calls.length).toBe(3);
    expect(cleanupSpy.mock.calls.length).toBe(3);

    setAtom(4);
    vi.runAllTimers();

    expect(reactionSpy.mock.calls.length).toBe(3);
    expect(cleanupSpy.mock.calls.length).toBe(3);
  });

  it("works with built-in async batching", () => {
    const [getAtom, setAtom] = createValue("start");

    reactive(() => {
      setAtom("reaction");
      getAtom();
    });

    expect(getAtom()).toBe("reaction");

    setAtom("order");

    expect(getAtom()).toBe("order");

    vi.runAllTimers();

    expect(getAtom()).toBe("reaction");
  });

  it("is batching updates", () => {
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

    vi.runAllTimers();

    expect(getAtom()).toBe("reaction2");
    expect(spy.mock.calls.length).toBe(2);
  });

  it("works with nested reactions", () => {
    const spy = vi.fn();
    const [getAtom, setAtom] = createValue(false);

    reactive(() => {
      if (!getAtom()) return;
      reactive(() => spy(getAtom()));
    });

    expect(spy.mock.calls.length).toBe(0);

    setAtom(true);

    vi.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);

    setAtom(false);

    vi.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
  });

  it("does not run scheduled reaction after context cleanup", () => {
    const cleanupSpy = vi.fn();
    const reactionSpy = vi.fn();
    const disposerId = createDisposer();
    const [getAtom, setAtom] = createValue(false);

    runWithOwner({ disposerId, reactionId: undefined }, () => {
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

    vi.runAllTimers();

    expect(reactionSpy.mock.calls.length).toBe(1);
  });
});
