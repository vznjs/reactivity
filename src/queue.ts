import { runWithContext } from "./context";

export type Queue = Set<() => void>;

export function flushQueue(queue: Queue): void {
  if (!queue.size) return;

  runWithContext({ disposer: undefined, computation: undefined }, () => {
    for (const task of queue) {
      try {
        task();
      } catch (error) {
        setTimeout(() => {
          throw error;
        }, 0);
      }
    }
  });

  queue.clear();
}

export function createQueue(): Queue {
  return new Set<() => void>();
}
