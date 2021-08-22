import { flushQueue } from "../utils/queue";
import type { Atom } from "./atom";
import { Computation, Reaction } from "./reaction";

const atomsQueue = new Set<Atom>();
const cancelQueue = new Set<Computation>();

let updatesQueue: Set<Computation> | undefined;

let isScheduled = false;

function scheduler() {
  updatesQueue = new Set();

  for (const atom of atomsQueue) {
    if (!atom.reactions) return;

    for (let index = 0; index < atom.reactions.length; index++) {
      const reaction = atom.reactions[index];

      if (!reaction) return;
      if (!cancelQueue.has(reaction.compute))
        updatesQueue.add(reaction.compute);
    }
  }

  atomsQueue.clear();
  cancelQueue.clear();

  flushQueue(updatesQueue);

  updatesQueue = undefined;
  isScheduled = false;
}

export function scheduleAtom(atom: Atom): void {
  if (!atom.reactions?.length) return;

  if (updatesQueue) {
    for (let index = 0; index < atom.reactions.length; index++) {
      updatesQueue.add(atom.reactions[index].compute);
    }
    return;
  }

  atomsQueue.add(atom);

  if (isScheduled) return;

  queueMicrotask(scheduler);

  isScheduled = true;
}

export function cancelReaction(reaction: Reaction): void {
  if (updatesQueue) {
    updatesQueue.delete(reaction.compute);
    return;
  }

  if (isScheduled) cancelQueue.add(reaction.compute);
}
