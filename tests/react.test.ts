import { createDisposer, flushDisposer, onCleanup } from "../src/core/disposer";
import { react } from "../src/react";
import { runWithContext } from "../src/core/context";
import { createValue } from "../src/reactive/value";

jest.useFakeTimers("modern");

describe("react", () => {
  it("reruns and cleanups on change", () => {
    const [getAtom, setAtom] = createValue(1);
    const disposer = createDisposer();
    const reactionSpy = jest.fn();
    const cleanupSpy = jest.fn();

    runWithContext({ disposer }, () => {
      react(() => {
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

    react(() => {
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

    react(() => {
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

    react(() => {
      if (!getAtom()) return;
      react(() => spy(getAtom()));
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

    runWithContext({ disposer }, () => {
      react(() => {
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
