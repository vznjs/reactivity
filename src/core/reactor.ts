import { flushQueue } from "../utils/queue";
import { getContext } from "./context";
import { getComputation } from "./reaction";

import type { Computation, ReactionId } from "./reaction";

export type Reactor = {
  updatesQueue?: Set<Computation>;
  reactionsQueue?: Array<ReactionId>;
};

const globalReactor: Reactor = createReactor();

export function createReactor(): Reactor {
  return Object.create(null) as Reactor;
}

export function startReactor(reactor: Reactor): void {
  reactor.updatesQueue = new Set();

  if (reactor.reactionsQueue) {
    reactor.reactionsQueue.sort();

    for (let index = 0; index < reactor.reactionsQueue.length; index++) {
      const computation = getComputation(reactor.reactionsQueue[index]);
      if (!computation) continue;

      reactor.updatesQueue.add(computation);
    }
  }

  delete reactor.reactionsQueue;

  flushQueue(reactor.updatesQueue);

  delete reactor.updatesQueue;
}

export function scheduleReactions(reactionsIds: Array<ReactionId>): void {
  if (!reactionsIds?.length) return;

  const currentReactor = getContext().reactor;
  const reactor = currentReactor || globalReactor;

  if (reactor.updatesQueue) {
    for (let index = 0; index < reactionsIds.length; index++) {
      const reactionId = reactionsIds[index];
      if (!reactionId) continue;

      const computation = getComputation(reactionId);
      if (!computation) continue;

      reactor.updatesQueue.add(computation);
    }
    return;
  }

  if (!reactor.reactionsQueue) {
    reactor.reactionsQueue = [];

    if (!currentReactor) {
      queueMicrotask(() => startReactor(globalReactor));
    }
  }

  for (let index = 0; index < reactionsIds.length; index++) {
    if (reactor.reactionsQueue.includes(reactionsIds[index])) continue;
    reactor.reactionsQueue.push(reactionsIds[index]);
  }
}

export function cancelReaction(reactionId: ReactionId): void {
  const reactor = getContext().reactor || globalReactor;

  if (reactor.updatesQueue) {
    const computation = getComputation(reactionId);
    if (!computation) return;

    reactor.updatesQueue.delete(computation);
  }

  if (reactor.reactionsQueue) {
    const index = reactor.reactionsQueue.indexOf(reactionId);
    if (index > -1) reactor.reactionsQueue.splice(index, 1);
  }
}

export function hasScheduledReaction(reactionId: ReactionId): boolean {
  const reactor = getContext().reactor || globalReactor;
  return !!reactor.reactionsQueue?.includes(reactionId);
}
