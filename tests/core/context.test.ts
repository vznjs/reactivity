import { describe, it, vi, expect } from "vitest";
import { runWithOwner, getOwner } from "../../src/core/owner";
import { createValue } from "../../src/reactive/value";
import { reactive } from "../../src/utils/reactive";
import { root } from "../../src/utils/root";
import { freeze } from "../../src/utils/freeze";
import {
  createDisposer,
  flushDisposer,
  onCleanup,
} from "../../src/core/disposer";
import { createReaction } from "../../src/core/reaction";

vi.useFakeTimers();

describe("root", () => {
  it("allows subreactions to escape their parents", () => {
    root(() => {
      const [getOuterAtom, setOuterAtom] = createValue(0);
      const [getInnerAtom, setInnerAtom] = createValue(0);
      const outerSpy = vi.fn();
      const innerSpy = vi.fn();

      reactive(() => {
        getOuterAtom();
        outerSpy();

        root(() => {
          reactive(() => {
            getInnerAtom();
            innerSpy();
          });
        });
      });

      expect(outerSpy.mock.calls.length).toBe(1);
      expect(innerSpy.mock.calls.length).toBe(1);

      // trigger the outer reaction, making more inners
      setOuterAtom(1);
      setOuterAtom(2);

      vi.runAllTimers();

      expect(outerSpy.mock.calls.length).toBe(2);
      expect(innerSpy.mock.calls.length).toBe(2);

      setInnerAtom(1);

      vi.runAllTimers();

      expect(outerSpy.mock.calls.length).toBe(2);
      expect(innerSpy.mock.calls.length).toBe(4);
    });
  });

  it("allows to dispose all nested reactions", () => {
    const spy = vi.fn();

    root((dispose) => {
      const [getAtom, setAtom] = createValue(1);

      reactive(() => {
        getAtom();
        spy();
      });

      expect(spy.mock.calls.length).toBe(1);

      setAtom(2);

      vi.runAllTimers();

      expect(spy.mock.calls.length).toBe(2);

      dispose();

      setAtom(3);

      vi.runAllTimers();

      expect(spy.mock.calls.length).toBe(2);
    });
  });
});

describe("freeze", () => {
  it("runs without any reaction", () => {
    const reactionId = createReaction(() => {
      // dummy
    });

    expect(getOwner().reactionId).toBeUndefined();

    runWithOwner({ disposerId: undefined, reactionId }, () => {
      expect(getOwner().reactionId).toBe(reactionId);

      freeze(() => {
        expect(getOwner().reactionId).toBeUndefined();
      });

      expect(getOwner().reactionId).toBe(reactionId);
    });

    expect(getOwner().reactionId).toBeUndefined();
  });

  it("runs cleanups in reaction correctly", () => {
    const disposerId = createDisposer();
    const cleanupMock = vi.fn();

    expect(getOwner().disposerId).toBeUndefined();

    runWithOwner({ disposerId, reactionId: undefined }, () => {
      freeze(() => {
        onCleanup(cleanupMock);
      });
    });

    expect(cleanupMock.mock.calls.length).toBe(0);

    flushDisposer(disposerId);

    expect(cleanupMock.mock.calls.length).toBe(1);
  });
});
