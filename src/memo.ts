import { onCleanup } from "./disposer";
import { runWithContext } from "./context";
import { createValue } from "./value";
import { createQueue, flushQueue } from "./queue";

export function createMemo<T>(fn: () => T): () => T {
  let memoValue: T;
  let isDirty = true;

  const [trackMemo, notifyChange] = createValue(true, false);
  const disposer = createQueue();

  function computation() {
    if (isDirty) return;

    isDirty = true;
    notifyChange(true);
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

    trackMemo();

    return memoValue;
  }

  return getter;
}
