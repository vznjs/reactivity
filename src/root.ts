import { runWithOwner } from "./owner";
import { createQueue, flushQueue } from "./queue";

/**
 * Computations created by root will live until dispose is called
 * 
 * @export
 * @template T
 * @param {(disposer: () => void) => T} fn
 * @returns {T}
 */
export function createRoot<T>(fn: (disposer: () => void) => T): T {
  const disposer = createQueue();
  return runWithOwner({ disposer, computation: undefined }, () => fn(() => flushQueue(disposer)));
}