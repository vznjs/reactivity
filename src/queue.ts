import { runWithOwner } from "./owner";

export type Queue = Set<() => void>

export function flushQueue(queue: Queue) {
  if (!queue.size) return;

  const tasks = [...queue];
  queue.clear();

  runWithOwner({ disposer: undefined, computation: undefined }, () => {
    for (let index = 0; index < tasks.length; index++) {
      try {
        tasks[index]();
      } catch (error) {
        setTimeout(() => { throw error; })
      }
    }
  })
}

export function createQueue(): Queue {
  return new Set<() => void>();
}
