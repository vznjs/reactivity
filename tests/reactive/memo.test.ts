import { createMemo } from "../../src/reactive/memo";
import { reactive } from "../../src/utils/reactive";
import { createValue } from "../../src/reactive/value";
import {
  createDisposer,
  flushDisposer,
  onCleanup,
} from "../../src/core/disposer";
import { runWith } from "../../src/core/context";

jest.useFakeTimers("modern");

describe("createMemo", () => {
  it("does recompute once only if changed", () => {
    const [getAtom, setAtom] = createValue(1);
    const spy = jest.fn();

    const getMemo = createMemo(() => {
      getAtom();
      spy();
    });

    setAtom(2);

    expect(spy.mock.calls.length).toBe(0);

    getMemo();
    getMemo();

    expect(spy.mock.calls.length).toBe(1);

    setAtom(3);
    setAtom(4);

    getMemo();

    expect(spy.mock.calls.length).toBe(2);
  });

  it("schedules only one reaction", () => {
    const [getAtom, setAtom] = createValue(1);
    const spy = jest.fn();

    expect(spy.mock.calls.length).toBe(0);

    const getMemo = createMemo(() => {
      getAtom();
      spy();
    });

    reactive(() => {
      getMemo();
    });

    expect(spy.mock.calls.length).toBe(1);

    setAtom(2);
    setAtom(3);

    expect(spy.mock.calls.length).toBe(1);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(2);
  });

  it("does recompute on every change in reaction", () => {
    const [getAtom, setAtom] = createValue(1);
    const disposer = createDisposer();
    const spy = jest.fn();

    runWith(disposer, undefined, () => {
      expect(spy.mock.calls.length).toBe(0);

      const getMemo = createMemo(() => {
        spy();
        return getAtom();
      });

      expect(spy.mock.calls.length).toBe(0);

      reactive(() => {
        getMemo();
      });

      expect(spy.mock.calls.length).toBe(1);

      setAtom(2);
      setAtom(3);

      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(2);

      getMemo();

      expect(spy.mock.calls.length).toBe(2);
    });
  });

  it("cleanups with each reaction", () => {
    const spy = jest.fn();

    const [getAtom] = createValue(1);
    const disposer = createDisposer();

    runWith(disposer, undefined, () => {
      const getMemo = createMemo(() => {
        onCleanup(spy);
        getAtom();
      });

      getMemo();

      expect(spy.mock.calls.length).toBe(0);

      flushDisposer(disposer);

      expect(spy.mock.calls.length).toBe(1);
    });
  });
});
