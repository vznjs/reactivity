import { schedule } from "./scheduler";
import { onCleanup } from "./disposer";
import { runWithOwner } from "./owner";
import { createQueue, flushQueue } from "./queue";

export function createReaction<T>(fn: (v: T) => T, value: T): void;
export function createReaction<T>(fn: (v?: T) => T | undefined): void;
export function createReaction<T>(fn: (v?: T) => T, value?: T): void {
  let lastValue = value;
  let isScheduled = false;
  
  const disposer = createQueue();

  function cleanup() {
    flushQueue(disposer);
  } 

  function computation() {
    if (isScheduled) return;
    schedule(recompute);
    isScheduled = true;
  }
  
  function recompute() {
    cleanup();
    runWithOwner({ computation, disposer }, () => lastValue = fn(lastValue))
    isScheduled = false;
  }

  try {
    recompute();
  } finally {
    onCleanup(cleanup);
  }
}
