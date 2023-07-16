import { describe, it, vi, expect } from "vitest";
import { createDisposer, flushDisposer, registerDisposable } from "../../src";

vi.useFakeTimers();

describe("disposer", () => {
  it("schedules disposer and calls it only on flush", () => {
    const disposerId = createDisposer();
    const cleanupMock = vi.fn();

    registerDisposable(cleanupMock, disposerId);

    vi.runAllTimers();

    expect(cleanupMock).toBeCalledTimes(0);

    flushDisposer(disposerId);

    expect(cleanupMock).toBeCalledTimes(1);
  });

  it("flushes immediately if inside of cleanup", () => {
    const disposerId = createDisposer();
    const cleanupMock = vi.fn();

    registerDisposable(() => {
      registerDisposable(cleanupMock);
      expect(cleanupMock).toBeCalledTimes(1);
    }, disposerId);

    vi.runAllTimers();

    expect(cleanupMock).toBeCalledTimes(0);

    flushDisposer(disposerId);

    expect(cleanupMock).toBeCalledTimes(1);
  });

  it("schedules global disposer if disposer not specified, and flush it", () => {
    const cleanupMock = vi.fn();

    registerDisposable(cleanupMock);

    expect(cleanupMock).toBeCalledTimes(0);

    vi.runAllTimers();

    expect(cleanupMock).toBeCalledTimes(1);
  });

  it("does not run disposables if not disposed", () => {
    const disposerId = createDisposer();
    const cleanupMock = vi.fn();

    registerDisposable(cleanupMock, disposerId);

    expect(cleanupMock).toBeCalledTimes(0);

    vi.runAllTimers();

    expect(cleanupMock).toBeCalledTimes(0);
  });
});
