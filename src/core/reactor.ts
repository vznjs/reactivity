import { flushQueue } from "../utils/queue";
import { getContext } from "./context";
import { getComputation } from "./reaction";
import { getReactions } from "./tracking";

import type { AtomId } from "./atom";
import type { Computation, ReactionId } from "./reaction";

export type Reactor = {
  updatesQueue?: Set<Computation>;
  reactionsQueue?: Set<ReactionId>;
};

const globalReactor: Reactor = createReactor();

export function createReactor(): Reactor {
  return Object.create(null) as Reactor;
}

export function startReactor(reactor: Reactor): void {
  reactor.updatesQueue = new Set();

  if (reactor.reactionsQueue) {
    for (const reactionId of reactor.reactionsQueue) {
      const computation = getComputation(reactionId);
      if (!computation) return;

      reactor.updatesQueue.add(computation);
    }
  }

  delete reactor.reactionsQueue;

  flushQueue(reactor.updatesQueue);

  delete reactor.updatesQueue;
}

export function scheduleAtom(atomId: AtomId): void {
  const reactionsIds = getReactions(atomId);
  if (!reactionsIds?.length) return;

  const currentReactor = getContext().reactor;
  const reactor = currentReactor || globalReactor;

  if (reactor.updatesQueue) {
    for (let index = 0; index < reactionsIds.length; index++) {
      const reactionId = reactionsIds[index];
      if (!reactionId) return;

      const computation = getComputation(reactionId);
      if (!computation) return;

      reactor.updatesQueue.add(computation);
    }
    return;
  }

  if (!reactor.reactionsQueue) {
    reactor.reactionsQueue = new Set();

    if (!currentReactor) {
      queueMicrotask(() => startReactor(globalReactor));
    }
  }

  for (let index = 0; index < reactionsIds.length; index++) {
    reactor.reactionsQueue.add(reactionsIds[index]);
  }
}

export function cancelReaction(reactionId: ReactionId): void {
  const reactor = getContext().reactor || globalReactor;

  if (reactor.updatesQueue) {
    const computation = getComputation(reactionId);
    if (!computation) return;

    reactor.updatesQueue.delete(computation);
    return;
  }

  if (reactor.reactionsQueue) {
    reactor.reactionsQueue.delete(reactionId);
  }
}

export function hasScheduledReaction(reactionId: ReactionId): boolean {
  const reactor = getContext().reactor || globalReactor;
  return !!reactor.reactionsQueue?.has(reactionId);
}
