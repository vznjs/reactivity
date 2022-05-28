import { runReaction } from "./reaction";

import type { ReactionId } from "./reaction";

const queue = new Set<ReactionId>();

let isWorking = false;
let isScheduled = false;
let order: Array<ReactionId> = [];

function findOrderPosition(value: number): number {
  for (let index = 0; index < order.length; index++) {
    const orderValue = order[index];
    if (orderValue >= value) return index;
  }

  return order.length;
}

function scheduleWorker() {
  isScheduled = true;

  queueMicrotask(() => {
    order = [...Uint32Array.from(queue.keys()).sort()];

    isWorking = true;

    while (order.length > 0) {
      const reactionId = order[0];
      const isQueued = queue.has(reactionId);

      if (!isQueued) continue;

      queue.delete(reactionId);
      order.shift();

      try {
        runReaction(reactionId);
      } catch (error) {
        setTimeout(() => {
          throw error;
        }, 0);
      }
    }

    isWorking = false;

    isScheduled = false;
  });
}

export function scheduleReactions(reactionsIds?: Array<ReactionId>): void {
  if (!reactionsIds) return;

  for (let index = 0; index < reactionsIds.length; index++) {
    const reactionId = reactionsIds[index];

    if (queue.has(reactionId)) return;

    queue.add(reactionId);

    if (isWorking) {
      order.splice(findOrderPosition(reactionId), 0, reactionId);
    }
  }

  if (!isScheduled) scheduleWorker();
}

export function cancelReaction(reactionId: ReactionId): void {
  queue.delete(reactionId);
  order.splice(order.indexOf(reactionId), 1);
}

export function hasScheduledReaction(reactionId: ReactionId): boolean {
  return queue.has(reactionId);
}
