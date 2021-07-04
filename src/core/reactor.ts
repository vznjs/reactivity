import { flushQueue, Queue } from "../utils/queue";
import type { Atom } from "./atom";

const atomsQueue = new Map<Atom, Queue>();
const unscheduleQueue = new Set<() => void>();

let updatesQueue: Queue | undefined;

let isScheduled = false;

function scheduler() {
  updatesQueue = [...atomsQueue.values()]
    .flat()
    .filter((reaction) => !unscheduleQueue.has(reaction));

  atomsQueue.clear();
  unscheduleQueue.clear();

  flushQueue(updatesQueue);

  updatesQueue = undefined;
  isScheduled = false;
}

export function scheduleAtomReactions(atom: Atom): void {
  const reactions = atom.reactions || [];

  if (!reactions.length) return;

  if (updatesQueue) {
    for (let index = 0; index < reactions.length; index++) {
      const reaction = reactions[index];

      if (updatesQueue.indexOf(reaction) === -1) {
        updatesQueue.push(reactions[index]);
      }
    }
    return;
  }

  atomsQueue.set(atom, reactions);

  if (isScheduled) return;

  queueMicrotask(scheduler);

  isScheduled = true;
}

export function cancelReaction(reaction: () => void): void {
  if (updatesQueue) {
    const index = updatesQueue.indexOf(reaction);
    if (index > -1) updatesQueue.splice(index, 1);
    return;
  }

  if (isScheduled) unscheduleQueue.add(reaction);
}
