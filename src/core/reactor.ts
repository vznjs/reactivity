import { getComputation } from "./reaction";

import type { ReactionId } from "./reaction";
import { requestCallback, cancelCallback, Task } from "./scheduler";

export enum Priority {
  NormalPriority = 3,
  LowPriority = 4,
}

const LOW_PRIORITY_TIMEOUT = 10000;

let reactionsQueue = new Map<ReactionId, Task | number>();

let taskPriority: Priority = Priority.NormalPriority;
let scheduled = false;

function performQueue() {
  reactionsQueue = new Map([...reactionsQueue.entries()].sort());

  for (const [reactionId, task] of reactionsQueue.entries()) {
    if (typeof task === "object") continue;

    if (task === Priority.NormalPriority) {
      reactionsQueue.delete(reactionId);

      try {
        getComputation(reactionId)?.();
      } catch (error) {
        setTimeout(() => {
          throw error;
        }, 0);
      }

      continue;
    }

    reactionsQueue.set(
      reactionId,
      requestCallback(
        () => {
          reactionsQueue.delete(reactionId);
          runWithPriority(task, getComputation(reactionId));
        },
        { timeout: LOW_PRIORITY_TIMEOUT }
      )
    );
  }
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
  if (!reactionsIds?.length) return;

  for (let index = 0; index < reactionsIds.length; index++) {
    const reactionId = reactionsIds[index];
    const task = reactionsQueue.get(reactionId);

    if (!task || (typeof task === "number" && task > taskPriority)) {
      reactionsQueue.set(reactionId, taskPriority);
    }
  }

  if (!scheduled) {
    scheduled = true;

    queueMicrotask(() => {
      performQueue();
      scheduled = false;
    });
  }
}

export function cancelReaction(reactionId: ReactionId): void {
  if (!reactionsQueue.has(reactionId)) return;

  const task = reactionsQueue.get(reactionId);
  if (typeof task === "object") cancelCallback(task);

  reactionsQueue.delete(reactionId);
}

export function hasScheduledReaction(reactionId: ReactionId): boolean {
  return !!reactionsQueue?.has(reactionId);
}
