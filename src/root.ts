import { runWithContext } from "./context";
import { Disposer, flushDisposer } from "./disposer";

/**
 * Computations created by root will live until dispose is called
 *
 * @export
 * @template T
 * @param {(disposer: () => void) => T} fn
 * @returns {T}
 */
export function createRoot<T>(fn: (disposer: () => void) => T): T {
  const disposer: Disposer = new Set();

  return runWithContext({ disposer, computation: undefined }, () =>
    fn(() => flushDisposer(disposer))
  );
}
