import { runWithContext } from "./context";

export type Queue = Array<() => void>;

export function flushQueue(queue: Queue): void {
  if (!queue.length) return;

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
}