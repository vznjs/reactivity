import type { Computation } from "./signal";
import { createQueue, flushQueue } from "./queue";
import type { Signal } from "./signal";

const updates = createQueue();
const signalsQueue = new Map<Signal, Computation[]>();
const unscheduledQueue = new Set<Computation>();

let isScheduled = false;
let isComputing = false;

function computeUpdates() {
  const queueArray = [...signalsQueue.values()];
  const unscheduledArray = [...unscheduledQueue];

  for (let index = 0; index < queueArray.length; index++) {
    const computationsArray = queueArray[index];

    for (let index = 0; index < computationsArray.length; index++) {
      updates.add(computationsArray[index]);
    }
  }

  for (let index = 0; index < unscheduledArray.length; index++) {
    updates.delete(unscheduledArray[index]);
  }

  signalsQueue.clear();
  unscheduledQueue.clear();

  flushQueue(updates);
}

export function scheduleUpdate(
  signal: Signal,
  computations: Computation[]
): void {
  if (isComputing) {
    for (let index = 0; index < computations.length; index++) {
      updates.add(computations[index]);
    }
    return;
  }

  signalsQueue.set(signal, computations);

  if (isScheduled) return;

  queueMicrotask(() => {
    isComputing = true;

    try {
      computeUpdates();
    } finally {
      isComputing = false;
      isScheduled = false;
    }
  });

  isScheduled = true;
}

export function unscheduleComputation(computation: Computation): void {
  if (isComputing) {
    updates.delete(computation);
    return;
  }

  if (isScheduled) unscheduledQueue.add(computation);
}
