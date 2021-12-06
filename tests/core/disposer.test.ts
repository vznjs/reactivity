import {
  createDisposer,
  flushDisposer,
  onCleanup,
} from "../../src/core/disposer";
import { runWith } from "../../src/core/context";
import { root } from "../../src/utils/root";

jest.useFakeTimers("modern");

describe("onCleanup", () => {
  it("schedules disposer and calls it on flush", () => {
    const disposerId = createDisposer();
    const cleanupMock = jest.fn();

    runWith({ disposerId, reactionId: undefined }, () => {
      onCleanup(cleanupMock);
    });

    expect(cleanupMock.mock.calls.length).toBe(0);

    flushDisposer(disposerId);

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
