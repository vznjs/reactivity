import { flushQueue } from "../utils/queue";
import type { Atom } from "./atom";
import { Reaction } from "./reaction";

const atomsQueue = new Map<Atom, Array<Reaction>>();
const unscheduleQueue = new Set<() => void>();

let updatesQueue: Set<() => void> | undefined;

let isScheduled = false;

function scheduler() {
  updatesQueue = new Set(
    [...atomsQueue.values()]
      .flat()
      .map((reaction) => reaction.compute)
      .filter((compute) => !unscheduleQueue.has(compute))
  );

  atomsQueue.clear();
  unscheduleQueue.clear();

  flushQueue(updatesQueue);

  updatesQueue = undefined;
  isScheduled = false;
}

export function scheduleAtom(atom: Atom): void {
  const reactions = atom.reactions || [];

  if (!reactions.length) return;

  if (updatesQueue) {
    for (let index = 0; index < reactions.length; index++) {
      updatesQueue.add(reactions[index].compute);
    }
    return;
  }

  atomsQueue.set(atom, reactions);

  if (isScheduled) return;

  queueMicrotask(scheduler);

  isScheduled = true;
}

export function cancelReaction(reaction: Reaction): void {
  if (updatesQueue) {
    updatesQueue.delete(reaction.compute);
    return;
  }

  if (isScheduled) unscheduleQueue.add(reaction.compute);
}
