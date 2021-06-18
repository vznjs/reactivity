import type { Computation } from "./signal";
import { flushQueue } from "./queue";
import type { Signal } from "./signal";

const signalsQueue = new Map<Signal, Computation[]>();
const unscheduleQueue = new Set<Computation>();

let updatesQueue: Set<Computation> | undefined;

let isScheduled = false;

function scheduler() {
  updatesQueue = new Set(
    [...signalsQueue.values()]
      .flat()
      .filter((computation) => !unscheduleQueue.has(computation))
  );

  signalsQueue.clear();
  unscheduleQueue.clear();

  flushQueue(updatesQueue);

  updatesQueue = undefined;
  isScheduled = false;
}

export function scheduleUpdate(
  signal: Signal,
  computations: Computation[]
): void {
  if (updatesQueue) {
    for (let index = 0; index < computations.length; index++) {
      updatesQueue.add(computations[index]);
    }
    return;
  }

  signalsQueue.set(signal, computations);

  if (isScheduled) return;

  queueMicrotask(scheduler);

  isScheduled = true;
}

export function unscheduleComputation(computation: Computation): void {
  if (updatesQueue) {
    updatesQueue.delete(computation);
    return;
  }

  if (isScheduled) unscheduleQueue.add(computation);
}
