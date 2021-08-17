import {
  root,
  freeze,
  setContext,
  getReaction,
  getDisposer,
} from "../../src/core/context";
import { createValue } from "../../src/reactive/value";
import { reactive } from "../../src/core/reactive";
import {
  createDisposer,
  flushDisposer,
  onCleanup,
} from "../../src/core/disposer";
import { createReaction } from "../../src/core/reaction";

jest.useFakeTimers("modern");

describe("root", () => {
  it("allows subreactions to escape their parents", () => {
    root(() => {
      const [getOuterAtom, setOuterAtom] = createValue(0);
      const [getInnerAtom, setInnerAtom] = createValue(0);
      const outerSpy = jest.fn();
      const innerSpy = jest.fn();

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

      jest.runAllTimers();

      expect(outerSpy.mock.calls.length).toBe(2);
      expect(innerSpy.mock.calls.length).toBe(2);

      setInnerAtom(1);

      jest.runAllTimers();

      expect(outerSpy.mock.calls.length).toBe(2);
      expect(innerSpy.mock.calls.length).toBe(4);
    });
  });

  it("allows to dispose all nested reactions", () => {
    const spy = jest.fn();

    root((dispose) => {
      const [getAtom, setAtom] = createValue(1);

      reactive(() => {
        getAtom();
        spy();
      });

      expect(spy.mock.calls.length).toBe(1);

      setAtom(2);

      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(2);

      dispose();

      setAtom(3);

      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(2);
    });
  });
});

describe("freeze", () => {
  it("runs without any reaction", () => {
    const reaction = createReaction(() => {
      // dummy
    });

    expect(getReaction()).toBeUndefined();

    setContext(undefined, reaction, () => {
      expect(getReaction()).toBe(reaction);

      freeze(() => {
        expect(getReaction()).toBeUndefined();
      });

      expect(getReaction()).toBe(reaction);
    });

    expect(getReaction()).toBeUndefined();
  });

  it("runs cleanups in reaction correctly", () => {
    const disposer = createDisposer();
    const cleanupMock = jest.fn();

    expect(getDisposer()).toBeUndefined();

    setContext(disposer, undefined, () => {
      freeze(() => {
        onCleanup(cleanupMock);
      });
    });

    expect(cleanupMock.mock.calls.length).toBe(0);

    flushDisposer(disposer);

    expect(cleanupMock.mock.calls.length).toBe(1);
  });
});
