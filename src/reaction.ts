import { unscheduleComputation } from "./scheduler";
import { Disposer, flushDisposer, onCleanup } from "./disposer";
import { runWithContext } from "./context";

export function createReaction<T>(fn: (v: T) => T, value: T): void;
export function createReaction<T>(fn: (v?: T) => T | undefined): void;
export function createReaction<T>(fn: (v?: T) => T, value?: T): void {
  const disposer: Disposer = new Set();

  function computation() {
    flushDisposer(disposer);
    runWithContext({ computation, disposer }, () => (value = fn(value)));
  }

  try {
    runWithContext({ computation, disposer }, () => (value = fn(value)));
  } finally {
    onCleanup(() => {
      unscheduleComputation(computation);
      flushDisposer(disposer);
    });
  }
}
