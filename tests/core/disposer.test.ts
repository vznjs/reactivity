import { describe, test, vi, expect } from "vitest";
import {
  createDisposer,
  flushDisposer,
  onCleanup,
} from "../../src/core/disposer";
import { runWithContext } from "../../src/core/context";
import { root } from "../../src/utils/root";

vi.useFakeTimers();

describe("onCleanup", () => {
  test("schedules disposer and calls it on flush", () => {
    const disposerId = createDisposer();
    const cleanupMock = vi.fn();

    runWithContext({ disposerId, reactionId: undefined }, () => {
      onCleanup(cleanupMock);
    });

    expect(cleanupMock.mock.calls.length).toBe(0);

    flushDisposer(disposerId);

    expect(cleanupMock.mock.calls.length).toBe(1);
  });

  test("supports nested cleanups", () => {
    const spy = vi.fn();

    root((dispose) => {
      onCleanup(() => {
        onCleanup(spy);
        spy();
      });
      dispose();
    });

    vi.runAllTimers();

    expect(spy.mock.calls.length).toBe(2);
  });

  test("does not run onCleanup if there is no reaction", () => {
    const cleanupMock = vi.fn();

    root(() => onCleanup(cleanupMock));

    expect(cleanupMock.mock.calls.length).toBe(0);

    vi.runAllTimers();

    expect(cleanupMock.mock.calls.length).toBe(0);
  });
});
