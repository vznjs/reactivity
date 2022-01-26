import { describe, it, vi, expect } from "vitest";
import { reactive } from "../../src/utils/reactive";
import { on } from "../../src/utils/on";
import { root } from "../../src/utils/root";
import { createValue } from "../../src/reactive/value";

vi.useFakeTimers();

describe("on", () => {
  it("reruns only on dependencies change", () => {
    const spy = vi.fn();
    const [getAtom, setAtom] = createValue(1);
    const [getAtom2, setAtom2] = createValue(1);

    root(() => {
      reactive(
        on(getAtom, (value?: number) => {
          spy(value);
          return getAtom2();
        })
      );
    });

    expect(spy.mock.calls.length).toBe(1);
    expect(spy.mock.calls[0][0]).toBe(undefined);

    setAtom2(2);
    vi.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);

    setAtom(2);
    vi.runAllTimers();

    expect(spy.mock.calls.length).toBe(2);
    expect(spy.mock.calls[1][0]).toBe(1);
  });

  it("does not run for the first time if defer is true", () => {
    const spy = vi.fn();
    const [getAtom, setAtom] = createValue(1);
    const [getAtom2, setAtom2] = createValue(1);

    root(() => {
      reactive(
        on(
          getAtom,
          (value?: number) => {
            spy(value);
            return getAtom2();
          },
          true
        )
      );
    });

    expect(spy.mock.calls.length).toBe(0);

    setAtom2(2);
    vi.runAllTimers();

    expect(spy.mock.calls.length).toBe(0);

    setAtom(2);
    vi.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
  });
});
