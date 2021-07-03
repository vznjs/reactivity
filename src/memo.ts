import { createDisposer, flushDisposer, onCleanup } from "./disposer";
import { runWithContext } from "./context";
import {
  createSignal,
  getRevision,
  notifySignal,
  Revision,
  Signal,
  trackSignal,
} from "./signal";
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
  const disposer = createDisposer();

  const computation: Computation = () => {
    lastRevision = getLatestRevision(computation[SIGNALS]);
    flushDisposer(disposer);
    notifySignal(signal);
  };

  function recompute() {
    runWithContext({ computation, disposer }, () => (memoValue = fn()));
    currentRevision = getLatestRevision(computation[SIGNALS]);
  }

  onCleanup(() => {
    const signals = new Set(computation[SIGNALS]);

    unscheduleComputation(computation);
    flushDisposer(disposer);

    computation[SIGNALS] = signals;
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

    trackSignal(signal);

    return memoValue;
  }

  return getter;
}
