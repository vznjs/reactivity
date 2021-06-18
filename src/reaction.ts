import { unscheduleComputation } from "./scheduler";
import { Disposer, flushDisposer, onCleanup } from "./disposer";
import { runWithContext } from "./context";

export function createReaction<T>(fn: (v: T) => T, value: T): void;
export function createReaction<T>(fn: (v?: T) => T | undefined): void;
export function createReaction<T>(fn: (v?: T) => T, value?: T): void {
  const disposer: Disposer = new Set();

  function recompute() {
    value = fn(value);
  }

  function computation() {
    flushDisposer(disposer);
    runWithContext({ computation, disposer }, recompute);
  }

  function cleanup() {
    unscheduleComputation(computation);
    flushDisposer(disposer);
  }

  try {
    runWithContext({ computation, disposer }, recompute);
  } finally {
    onCleanup(cleanup);
  }
}
