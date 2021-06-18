import { Disposer, flushDisposer, onCleanup } from "../src/disposer";
import { runWithContext } from "../src/context";
import { createRoot } from "../src/root";

jest.useFakeTimers("modern");

describe("onCleanup", () => {
  it("schedules disposer and calls it on flush", () => {
    const disposer: Disposer = new Set();
    const cleanupMock = jest.fn();

    runWithContext({ disposer }, () => {
      onCleanup(cleanupMock);
    });

    expect(cleanupMock.mock.calls.length).toBe(0);

    flushDisposer(disposer);

    expect(cleanupMock.mock.calls.length).toBe(1);
  });

  it("supports nested cleanups", () => {
    const spy = jest.fn();

    createRoot((dispose) => {
      onCleanup(() => {
        onCleanup(spy);
        spy();
      });
      dispose();
    });

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(2);
  });

  it("does not run onCleanup if there is no computation", () => {
    const cleanupMock = jest.fn();

    createRoot(() => onCleanup(cleanupMock));

    expect(cleanupMock.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(cleanupMock.mock.calls.length).toBe(0);
  });
});
