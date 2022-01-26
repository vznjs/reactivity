import { describe, it, vi, expect } from "vitest";
import { createMemo } from "../../src/reactive/memo";
import { reactive } from "../../src/utils/reactive";
import { createValue } from "../../src/reactive/value";
import {
  createDisposer,
  flushDisposer,
  onCleanup,
} from "../../src/core/disposer";
import { runWithContext } from "../../src/core/context";
import { root } from "../../src";

vi.useFakeTimers();

describe("createMemo", () => {
  it("does recompute once only if changed", () => {
    const [getValue, setValue] = createValue(1);
    const spy = vi.fn();

    const getMemo = createMemo(() => {
      getValue();
      spy();
    });

    setValue(2);

    expect(spy.mock.calls.length).toBe(0);

    getMemo();
    getMemo();

    expect(spy.mock.calls.length).toBe(1);

    setValue(3);
    setValue(4);

    getMemo();
    getMemo();

    expect(spy.mock.calls.length).toBe(2);
  });

  it("schedules only one reaction", () => {
    const [getValue, setValue] = createValue(1);
    const spy = vi.fn();

    expect(spy.mock.calls.length).toBe(0);

    root(() => {
      const getMemo = createMemo(() => {
        getValue();
        spy();
      });

      reactive(() => {
        getMemo();
      });

      expect(spy.mock.calls.length).toBe(1);

      setValue(2);
      setValue(3);

      vi.runAllTimers();

      expect(spy.mock.calls.length).toBe(2);
    });
  });

  it("schedules only one reaction even when using getter", () => {
    const [getValue, setValue] = createValue(1);
    const spy = vi.fn();

    expect(spy.mock.calls.length).toBe(0);

    root(() => {
      const getMemo = createMemo(() => {
        getValue();
        spy();
      });

      reactive(() => {
        getMemo();
      });

      expect(spy.mock.calls.length).toBe(1);

      vi.runAllTimers();

      expect(spy.mock.calls.length).toBe(1);

      setValue(2);
      setValue(3);

      getMemo();

      expect(spy.mock.calls.length).toBe(2);

      vi.runAllTimers();

      expect(spy.mock.calls.length).toBe(2);

      setValue(4);

      vi.runAllTimers();

      expect(spy.mock.calls.length).toBe(3);

      getMemo();

      expect(spy.mock.calls.length).toBe(3);
    });
  });

  it("does recompute on every change in reaction", () => {
    const [getAtom, setAtom] = createValue(1);
    const disposerId = createDisposer();
    const spy = vi.fn();

    runWithContext({ disposerId, reactionId: undefined }, () => {
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

      vi.runAllTimers();

      expect(spy.mock.calls.length).toBe(2);

      getMemo();

      expect(spy.mock.calls.length).toBe(2);
    });
  });

  it("cleanups with each reaction", () => {
    const spy = vi.fn();

    const [getAtom] = createValue(1);
    const disposerId = createDisposer();

    runWithContext({ disposerId, reactionId: undefined }, () => {
      const getMemo = createMemo(() => {
        onCleanup(spy);
        getAtom();
      });

      getMemo();

      expect(spy.mock.calls.length).toBe(0);

      flushDisposer(disposerId);

      expect(spy.mock.calls.length).toBe(1);
    });
  });
});
