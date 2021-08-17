import {
  createDisposer,
  flushDisposer,
  onCleanup,
} from "../../src/core/disposer";
import { reactive } from "../../src/core/reactive";
import { runWith } from "../../src/core/context";
import { createValue } from "../../src/reactive/value";

jest.useFakeTimers("modern");

describe("reactive", () => {
  it("reruns and cleanups on change", () => {
    const [getAtom, setAtom] = createValue(1);
    const disposer = createDisposer();
    const reactionSpy = jest.fn();
    const cleanupSpy = jest.fn();

    runWith(disposer, undefined, () => {
      reactive(() => {
        onCleanup(cleanupSpy);
        reactionSpy();
        getAtom();
      });
    });

    expect(reactionSpy.mock.calls.length).toBe(1);
    expect(cleanupSpy.mock.calls.length).toBe(0);

    setAtom(2);
    jest.runAllTimers();

    expect(reactionSpy.mock.calls.length).toBe(2);
    expect(cleanupSpy.mock.calls.length).toBe(1);

    setAtom(3);
    jest.runAllTimers();

    expect(reactionSpy.mock.calls.length).toBe(3);
    expect(cleanupSpy.mock.calls.length).toBe(2);

    flushDisposer(disposer);

    expect(reactionSpy.mock.calls.length).toBe(3);
    expect(cleanupSpy.mock.calls.length).toBe(3);

    setAtom(4);
    jest.runAllTimers();

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

    jest.runAllTimers();

    expect(getAtom()).toBe("reaction");
  });

  it("is batching updates", () => {
    const [getAtom, setAtom] = createValue("start");
    const spy = jest.fn();

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

    jest.runAllTimers();

    expect(getAtom()).toBe("reaction2");
    expect(spy.mock.calls.length).toBe(2);
  });

  it("works with nested reactions", () => {
    const spy = jest.fn();
    const [getAtom, setAtom] = createValue(false);

    reactive(() => {
      if (!getAtom()) return;
      reactive(() => spy(getAtom()));
    });

    expect(spy.mock.calls.length).toBe(0);

    setAtom(true);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);

    setAtom(false);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
  });

  it("does not run scheduled reaction after context cleanup", () => {
    const cleanupSpy = jest.fn();
    const reactionSpy = jest.fn();
    const disposer = createDisposer();
    const [getAtom, setAtom] = createValue(false);

    runWith(disposer, undefined, () => {
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

    flushDisposer(disposer);

    expect(cleanupSpy.mock.calls.length).toBe(1);

    jest.runAllTimers();

    expect(reactionSpy.mock.calls.length).toBe(1);
  });
});
