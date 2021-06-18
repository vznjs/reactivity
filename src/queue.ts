import { runWithContext } from "./context";

export type Queue = Set<() => void>;

export function flushQueue(queue: Queue): void {
  if (!queue.size) return;

  function flush() {
    for (const task of queue) {
      try {
        task();
      } catch (error) {
        setTimeout(() => {
          throw error;
        }, 0);
      }
    }
  }

  runWithContext({ disposer: undefined, computation: undefined }, flush);

  queue.clear();
}