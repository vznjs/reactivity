import { unscheduleComputation } from "./scheduler";
import { onCleanup } from "./disposer";
import { runWithContext } from "./context";
import { flushQueue, Queue } from "./queue";

export function createReaction<T>(fn: (v: T) => T, value: T): void;
export function createReaction<T>(fn: (v?: T) => T | undefined): void;
export function createReaction<T>(fn: (v?: T) => T, value?: T): void {
  const disposer: Queue = new Set();

  function computation() {
    flushQueue(disposer);
    runWithContext({ computation, disposer }, () => (value = fn(value)));
  }

  try {
    runWithContext({ computation, disposer }, () => (value = fn(value)));
  } finally {
    onCleanup(() => {
      unscheduleComputation(computation);
      flushQueue(disposer);
    });
  }
}
