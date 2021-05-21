import { createRoot } from "../src/root";
import { createValue } from "../src/value";
import { createReaction } from "../src/reaction";
import { runWithContext } from "../src/context";
import { createQueue, flushQueue } from "../src/queue";
import { onCleanup } from "../src/disposer";

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
    const [getSignal, setSignal] = createValue(false);

    runWithContext({ computation: spy }, () => getSignal());

    expect(spy.mock.calls.length).toBe(0);
    expect(getSignal()).toBe(false);

    setSignal(true);

    expect(spy.mock.calls.length).toBe(1);
    expect(getSignal()).toBe(true);
  });

  it("triggers computation if compare option is false and values are equal", () => {
    const spy = jest.fn();
    const [getSignal, setSignal] = createValue(true, false);

    runWithContext({ computation: spy }, () => getSignal());

    expect(spy.mock.calls.length).toBe(0);

    setSignal(true);

    expect(spy.mock.calls.length).toBe(1);
  });

  it("does not trigger computation if set to equal value", () => {
    const spy = jest.fn();
    const [getSignal, setSignal] = createValue(false);

    runWithContext({ computation: spy }, () => getSignal());

    expect(spy.mock.calls.length).toBe(0);
    expect(getSignal()).toBe(false);

    setSignal(false);

    expect(spy.mock.calls.length).toBe(0);
    expect(getSignal()).toBe(false);
  });

  it("can take an equality predicate", () => {
    const spy = jest.fn();
    const [getSignal, setSignal] = createValue([1], (a, b) => a[0] === b[0]);

    runWithContext({ computation: spy }, () => getSignal());

    expect(spy.mock.calls.length).toBe(0);

    setSignal([1]);

    expect(spy.mock.calls.length).toBe(0);

    setSignal([2]);

    expect(spy.mock.calls.length).toBe(1);
  });

  it("removes subscriptions on cleanup", () => {
    const spy = jest.fn();
    const [getSignal, setSignal] = createValue(false);
    const disposer = createQueue();

    runWithContext({ disposer, computation: spy }, () => getSignal());

    setSignal(true);

    expect(spy.mock.calls.length).toBe(1);
    expect(getSignal()).toBe(true);

    flushQueue(disposer);

    setSignal(false);

    expect(spy.mock.calls.length).toBe(1);
    expect(getSignal()).toBe(false);
  });

  it("ignores recomputation with circular dependencies", () => {
    const spy = jest.fn();
    const [getSignal, setSignal] = createValue(0);
    const disposer = createQueue();

    runWithContext({ disposer, computation: spy }, () =>
      setSignal(getSignal() + 1)
    );

    expect(spy.mock.calls.length).toBe(0);
    expect(getSignal()).toBe(1);

    setSignal(getSignal() + 1);

    expect(spy.mock.calls.length).toBe(1);
    expect(getSignal()).toBe(2);
  });

  it("uses global queue of updates (aka S.js subclocks)", () => {
    const spy = jest.fn();
    const [getSignal, setSignal] = createValue(20);

    createReaction(() => {
      while (getSignal() <= 10) {
        setSignal(getSignal() + 1);
      }
    });

    createReaction(() => spy(getSignal()));

    expect(spy.mock.calls.length).toBe(1);

    setSignal(5);
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
    const disposer = createQueue();

    createRoot(() => {
      createReaction(() => {
        onCleanup(() => flushQueue(disposer));
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
});
