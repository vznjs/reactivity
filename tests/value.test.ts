import { createRoot } from "../src/root";
import { createValue } from "../src/value";
import { createReaction } from "../src/reaction";
import { runWithContext } from "../src/context";
import { createDisposer, flushDisposer, onCleanup } from "../src/disposer";

jest.useFakeTimers("modern");

describe("createValue", () => {
  it("takes and returns an initial value", () => {
    const [getValue] = createValue(1);
    expect(getValue()).toBe(1);
  });

  it("can be set by passing in a new value", () => {
    const [getValue, setValue] = createValue(1);
    setValue(2);
    expect(getValue()).toBe(2);
  });

  it("triggers computation if values are not equal", () => {
    const spy = jest.fn();
    const [getAtom, setAtom] = createValue(false);

    runWithContext({ computation: spy }, () => getAtom());

    expect(spy.mock.calls.length).toBe(0);
    expect(getAtom()).toBe(false);

    setAtom(true);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
    expect(getAtom()).toBe(true);
  });

  it("triggers computation if compare option is false and values are equal", () => {
    const spy = jest.fn();
    const [getAtom, setAtom] = createValue(true, false);

    runWithContext({ computation: spy }, () => getAtom());

    expect(spy.mock.calls.length).toBe(0);

    setAtom(true);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
  });

  it("does not trigger computation if set to equal value", () => {
    const spy = jest.fn();
    const [getAtom, setAtom] = createValue(false);

    createRoot(() => {
      runWithContext({ computation: spy }, () => getAtom());

      expect(spy.mock.calls.length).toBe(0);
      expect(getAtom()).toBe(false);

      setAtom(false);

      expect(spy.mock.calls.length).toBe(0);
      expect(getAtom()).toBe(false);

      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(0);
      expect(getAtom()).toBe(false);

      setAtom(true);

      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(1);
      expect(getAtom()).toBe(true);
    });
  });

  it("can take an equality predicate", () => {
    const spy = jest.fn();
    const [getAtom, setAtom] = createValue([1], (a, b) => a[0] === b[0]);

    createRoot(() => {
      runWithContext({ computation: spy }, () => getAtom());

      expect(spy.mock.calls.length).toBe(0);

      setAtom([1]);

      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(0);

      setAtom([2]);

      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(1);
    });
  });

  it("removes subscriptions on cleanup", () => {
    const spy = jest.fn();
    const [getAtom, setAtom] = createValue(false);
    const disposer = createDisposer();

    runWithContext({ disposer, computation: spy }, () => getAtom());

    setAtom(true);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
    expect(getAtom()).toBe(true);

    flushDisposer(disposer);

    setAtom(false);

    expect(spy.mock.calls.length).toBe(1);
    expect(getAtom()).toBe(false);
  });

  it("ignores recomputation with circular dependencies", () => {
    const spy = jest.fn();
    const [getAtom, setAtom] = createValue(0);
    const disposer = createDisposer();

    runWithContext({ disposer, computation: spy }, () =>
      setAtom(getAtom() + 1)
    );

    expect(spy.mock.calls.length).toBe(0);
    expect(getAtom()).toBe(1);

    setAtom(getAtom() + 1);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
    expect(getAtom()).toBe(2);
  });

  it("uses global queue of updates (aka S.js subclocks)", () => {
    const spy = jest.fn();
    const [getAtom, setAtom] = createValue(20);

    createRoot(() => {
      createReaction(() => {
        while (getAtom() <= 10) {
          setAtom(getAtom() + 1);
        }
      });

      createReaction(() => spy(getAtom()));
    });

    expect(spy.mock.calls.length).toBe(1);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);

    setAtom(5);
    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(2);
  });

  it("works with cross-updates", () => {
    const spy = jest.fn();
    const [getData, setData] = createValue(2);
    const [getData2, setData2] = createValue(2);

    createRoot(() => {
      createReaction(() => {
        getData2();
        spy();
      });

      createReaction(() => {
        setData2(getData() + 1);
      });

      expect(spy.mock.calls.length).toBe(1);

      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(2);

      setData(5);
      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(3);
    });
  });

  it("works with nested updates and cleanups", () => {
    const spy = jest.fn();
    const spy2 = jest.fn();
    const [getData, setData] = createValue(1);
    const disposer = createDisposer();

    createRoot(() => {
      createReaction(() => {
        onCleanup(() => flushDisposer(disposer));
        getData();
        spy();
      });

      runWithContext({ disposer }, () => {
        createReaction(() => {
          getData();
          spy2();
        });
      });

      expect(spy.mock.calls.length).toBe(1);
      expect(spy2.mock.calls.length).toBe(1);

      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(1);
      expect(spy2.mock.calls.length).toBe(1);

      setData(2);

      expect(spy.mock.calls.length).toBe(1);
      expect(spy2.mock.calls.length).toBe(1);

      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(2);
      expect(spy2.mock.calls.length).toBe(1);
    });
  });

  it("does not recompute computations used after change", () => {
    const spy = jest.fn();
    const [getAtom, setAtom] = createValue(false);

    createRoot(() => {
      setAtom(true);

      createReaction(() => {
        getAtom();
        spy();
      });
    });

    expect(spy.mock.calls.length).toBe(1);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
  });
});
