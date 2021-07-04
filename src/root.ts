import { runWithContext } from "./context";
import { createDisposer, flushDisposer } from "./disposer";

/**
 * Reactions created by root will live until dispose is called
 *
 * @export
 * @template T
 * @param {(disposer: () => void) => T} fn
 * @returns {T}
 */
export function createRoot<T>(fn: (disposer: () => void) => T): T {
  const disposer = createDisposer();

  return runWithContext({ disposer, reaction: undefined }, () =>
    fn(() => flushDisposer(disposer))
  );
}