import { flushQueue, Queue } from "./queue";
import type { Atom } from "./atom";

const atomsQueue = new Map<Atom, Queue>();
const unscheduleQueue = new Set<() => void>();

let updatesQueue: Queue | undefined;

let isScheduled = false;

function scheduler() {
  updatesQueue = [...atomsQueue.values()]
    .flat()
    .filter((computation) => !unscheduleQueue.has(computation));

  atomsQueue.clear();
  unscheduleQueue.clear();

  flushQueue(updatesQueue);

  updatesQueue = undefined;
  isScheduled = false;
}

export function scheduleUpdate(atom: Atom, computations: Queue): void {
  if (updatesQueue) {
    for (let index = 0; index < computations.length; index++) {
      const computation = computations[index];

      if (updatesQueue.indexOf(computation) === -1) {
        updatesQueue.push(computations[index]);
      }
    }
    return;
  }

  atomsQueue.set(atom, computations);

  if (isScheduled) return;

  queueMicrotask(scheduler);

  isScheduled = true;
}

export function cancelComputation(computation: () => void): void {
  if (updatesQueue) {
    const index = updatesQueue.indexOf(computation);
    if (index > -1) updatesQueue.splice(index, 1);
    return;
  }

  if (isScheduled) unscheduleQueue.add(computation);
}
