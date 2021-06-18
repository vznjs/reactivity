import { Disposer, flushDisposer, onCleanup } from "./disposer";
import { runWithContext } from "./context";
import { createSignal, getRevision, Revision, Signal } from "./signal";
import { Computation, SIGNALS } from "./signal";
import { unscheduleComputation } from "./scheduler";

function getLatestRevision(signals: Set<Signal> | Signal[] = []): Revision {
  const arr = [...signals];
  let max = 0;

  for (let index = 0; index < arr.length; index++) {
    const signal = arr[index];
    if (signal.revision > max) max = signal.revision;
  }

  return max;
}

export function createMemo<T>(fn: () => T): () => T {
  let memoValue: T;
  let currentRevision = getRevision();
  let lastRevision = currentRevision;

  const signal = createSignal();
  const disposer: Disposer = new Set();

  const computation: Computation = () => {
    lastRevision = getLatestRevision(computation[SIGNALS]);
    flushDisposer(disposer);
    signal.notify();
  };

  function recompute() {
    runWithContext({ computation, disposer }, () => (memoValue = fn()));
    currentRevision = getLatestRevision(computation[SIGNALS]);
  }

  onCleanup(() => {
    Reflect.deleteProperty(computation, SIGNALS);
    unscheduleComputation(computation);
    flushDisposer(disposer);
  });

  function getter() {
    const signals = computation[SIGNALS];

    if (!signals) {
      computation[SIGNALS] = new Set<Signal>();
      recompute();
    } else if (currentRevision < lastRevision) {
      recompute();
    } else if (currentRevision < getLatestRevision(signals)) {
      flushDisposer(disposer);
      recompute();
    }

    signal.track();

    return memoValue;
  }

  return getter;
}
