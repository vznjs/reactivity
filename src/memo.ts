import { onCleanup } from "./disposer";
import { runWithContext } from "./context";
import { createQueue, flushQueue } from "./queue";
import { createSignal } from "./signal";

export function createMemo<T>(fn: () => T): () => T {
  let memoValue: T;
  let isDirty = true;

  const signal = createSignal();
  const disposer = createQueue();

  function computation() {
    if (isDirty) return;

    isDirty = true;
    signal.notify();
  }

  function recomputeMemo() {
    memoValue = fn();
  }

  onCleanup(() => {
    flushQueue(disposer);
    isDirty = true;
  });

  function getter() {
    if (isDirty) {
      flushQueue(disposer);
      runWithContext({ computation, disposer }, recomputeMemo);
      isDirty = false;
    }

    signal.track();

    return memoValue;
  }

  return getter;
}
