import { unscheduleComputation } from "./scheduler";
import { onCleanup } from "./disposer";
import { runWithContext } from "./context";
import { createQueue, flushQueue } from "./queue";

export function createReaction<T>(fn: (v: T) => T, value: T): void;
export function createReaction<T>(fn: (v?: T) => T | undefined): void;
export function createReaction<T>(fn: (v?: T) => T, value?: T): void {
  let lastValue = value;

  const disposer = createQueue();

  function computation() {
    flushQueue(disposer);
    recompute();
  }

  function recompute() {
    runWithContext(
      { computation, disposer },
      () => (lastValue = fn(lastValue))
    );
  }

  try {
    recompute();
  } finally {
    onCleanup(() => {
      unscheduleComputation(computation);
      flushQueue(disposer);
    });
  }
}
