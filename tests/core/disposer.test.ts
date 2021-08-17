import {
  createDisposer,
  flushDisposer,
  onCleanup,
} from "../../src/core/disposer";
import { root, setContext } from "../../src/core/context";

jest.useFakeTimers("modern");

describe("onCleanup", () => {
  it("schedules disposer and calls it on flush", () => {
    const disposer = createDisposer();
    const cleanupMock = jest.fn();

    setContext(disposer, undefined, () => {
      onCleanup(cleanupMock);
    });

    expect(cleanupMock.mock.calls.length).toBe(0);

    flushDisposer(disposer);

    expect(cleanupMock.mock.calls.length).toBe(1);
  });

  it("supports nested cleanups", () => {
    const spy = jest.fn();

    root((dispose) => {
      onCleanup(() => {
        onCleanup(spy);
        spy();
      });
      dispose();
    });

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(2);
  });

  it("does not run onCleanup if there is no reaction", () => {
    const cleanupMock = jest.fn();

    root(() => onCleanup(cleanupMock));

    expect(cleanupMock.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(cleanupMock.mock.calls.length).toBe(0);
  });
});
