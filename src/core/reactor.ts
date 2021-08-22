import { flushQueue } from "../utils/queue";
import type { Atom } from "./atom";
import { getReactor } from "./context";
import { Computation, Reaction } from "./reaction";

export type Reactor = {
  updatesQueue?: Set<Computation>;
  cancelQueue?: Set<Computation>;
  atomsQueue?: Set<Atom>;
};

const globalReactor: Reactor = createReactor();

export function createReactor(): Reactor {
  return {} as Reactor;
}

export function startReactor(reactor: Reactor): void {
  reactor.updatesQueue = new Set();

  if (reactor.atomsQueue) {
    for (const atom of reactor.atomsQueue) {
      if (!atom.reactions) return;

      for (let index = 0; index < atom.reactions.length; index++) {
        const reaction = atom.reactions[index];

        if (!reaction) return;

        if (!reactor.cancelQueue?.has(reaction.compute)) {
          reactor.updatesQueue.add(reaction.compute);
        }
      }
    }
  }

  reactor.atomsQueue = undefined;
  reactor.cancelQueue = undefined;

  flushQueue(reactor.updatesQueue);

  reactor.updatesQueue = undefined;
}

export function scheduleAtom(atom: Atom): void {
  if (!atom.reactions?.length) return;

  const currentReactor = getReactor();
  const reactor = currentReactor || globalReactor;

  if (reactor.updatesQueue) {
    for (let index = 0; index < atom.reactions.length; index++) {
      reactor.updatesQueue.add(atom.reactions[index].compute);
    }
    return;
  }

  if (!reactor.atomsQueue) {
    reactor.atomsQueue = new Set();

    if (!currentReactor) {
      queueMicrotask(() => startReactor(globalReactor));
    }
  }

  reactor.atomsQueue.add(atom);
}

export function cancelReaction(reaction: Reaction): void {
  const reactor = getReactor() || globalReactor;

  if (reactor.updatesQueue) {
    reactor.updatesQueue.delete(reaction.compute);
    return;
  }

  if (reactor.atomsQueue) {
    reactor.cancelQueue ??= new Set();
    reactor.cancelQueue.add(reaction.compute);
  }
}
