import { schedule, unschedule } from "./scheduler";
import { onCleanup } from "./disposer";
import { runWithContext } from "./context";
import { createQueue, flushQueue } from "./queue";

export function createReaction<T>(fn: (v: T) => T, value: T): void;
export function createReaction<T>(fn: (v?: T) => T | undefined): void;
export function createReaction<T>(fn: (v?: T) => T, value?: T): void {
  let lastValue = value;
  let isScheduled = false;

  const disposer = createQueue();

  function computation() {
    if (isScheduled) return;
    flushQueue(disposer);
    schedule(recompute);
    isScheduled = true;
  }

  function recompute() {
    runWithContext(
      { computation, disposer },
      () => (lastValue = fn(lastValue))
    );
    isScheduled = false;
  }

  try {
    recompute();
  } finally {
    onCleanup(() => {
      unschedule(recompute);
      flushQueue(disposer);
    });
  }
}
