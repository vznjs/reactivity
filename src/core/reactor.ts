import { getComputation } from "./reaction";

import type { ReactionId } from "./reaction";
import type { Task } from "./scheduler";

export enum Priority {
  NormalPriority = 3,
  LowPriority = 4,
}

// const LOW_PRIORITY_TIMEOUT = 10000;
const queue = new Map<ReactionId, Task | Priority>();

let isWorking = false;
let scheduled = false;
let taskPriority = Priority.NormalPriority;
let order: Array<ReactionId> = [];

function findOrderPosition(value: number): number {
  for (let index = 0; index < order.length; index++) {
    const orderValue = order[index];
    if (orderValue >= value) return index;
  }

  return order.length;
}

function scheduleWorker() {
  scheduled = true;

  queueMicrotask(() => {
    order = [...Uint32Array.from(queue.keys()).sort()];

    isWorking = true;
    performQueue();
    isWorking = false;

    scheduled = false;
  });
}

function performQueue() {
  while (order.length > 0) {
    const reactionId = order[0];
    const task = queue.get(reactionId);
    if (!task || typeof task === "object") continue;

    queue.delete(reactionId);
    order.shift();

    try {
      getComputation(reactionId)?.();
    } catch (error) {
      setTimeout(() => {
        throw error;
      }, 0);
    }
  }

  // if (task === Priority.NormalPriority) {
  // continue;
  // }

  // workingQueue.set(
  //   reactionId,
  //   requestCallback(
  //     () => {
  //       workingQueue.delete(reactionId);
  //       runWithPriority(task, getComputation(reactionId));
  //     },
  //     { timeout: LOW_PRIORITY_TIMEOUT }
  //   )
  // );
  // }
}

export function runWithPriority<T>(
  priority: Priority,
  fn?: () => T
): T | undefined {
  const prev = taskPriority;

  try {
    taskPriority = priority;
    return fn?.();
  } finally {
    taskPriority = prev;
  }
}

export function scheduleReactions(reactionsIds: Array<ReactionId>): void {
  for (let index = 0; index < reactionsIds.length; index++) {
    const reactionId = reactionsIds[index];
    const task = queue.get(reactionId);

    if (!task || (typeof task === "number" && task > taskPriority)) {
      queue.set(reactionId, taskPriority);
    }

    if (task) return;

    if (isWorking) {
      order.splice(findOrderPosition(reactionId), 0, reactionId);
    } else {
      order.push(reactionId);
    }
  }

  if (!scheduled) scheduleWorker();
}

export function cancelReaction(reactionId: ReactionId): void {
  // const task = reactorQueue.get(reactionId);
  // if (task && typeof task === "object") cancelCallback(task);

  queue.delete(reactionId);
  order.splice(order.indexOf(reactionId), 1);
}

export function hasScheduledReaction(reactionId: ReactionId): boolean {
  return queue.has(reactionId);
}
