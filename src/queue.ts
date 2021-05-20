import { runWithContext } from "./context";

export type Queue = Set<() => void>;

export function flushQueue(queue: Queue): void {
  if (!queue.size) return;

  const tasks = [...queue];
  queue.clear();

  runWithContext({ disposer: undefined, computation: undefined }, () => {
    for (let index = 0; index < tasks.length; index++) {
      try {
        tasks[index]();
      } catch (error) {
        setTimeout(() => {
          throw error;
        }, 0);
      }
    }
  });
}

export function createQueue(): Queue {
  return new Set<() => void>();
}
