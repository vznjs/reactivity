import { flushQueue } from "../utils/queue";
import type { Atom } from "./atom";

const atomsQueue = new Map<Atom, Array<() => void>>();
const unscheduleQueue = new Set<() => void>();

let updatesQueue: Set<() => void> | undefined;

let isScheduled = false;

function scheduler() {
  updatesQueue = new Set(
    [...atomsQueue.values()]
          .flat()
          .filter((reaction) => !unscheduleQueue.has(reaction))
  );

  atomsQueue.clear();
  unscheduleQueue.clear();

  flushQueue(updatesQueue)

  updatesQueue = undefined;
  isScheduled = false;
}

export function scheduleAtomReactions(atom: Atom): void {
  const reactions = atom.reactions || [];

  if (!reactions.length) return;

  if (updatesQueue) {
    for (let index = 0; index < reactions.length; index++) {
      updatesQueue.add(reactions[index]);
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
    updatesQueue.delete(reaction)
    return;
  }

  if (isScheduled) unscheduleQueue.add(reaction);
}
