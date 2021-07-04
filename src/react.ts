import { cancelReaction } from "./core/reactor";
import { createDisposer, flushDisposer, onCleanup } from "./core/disposer";
import { runWithContext } from "./core/context";

export function react<T>(fn: (v: T) => T, value: T): void;
export function react<T>(fn: (v?: T) => T | undefined): void;
export function react<T>(fn: (v?: T) => T, value?: T): void {
  const disposer = createDisposer();

  function recompute() {
    value = fn(value);
  }

  function reaction() {
    flushDisposer(disposer);
    runWithContext({ reaction, disposer }, recompute);
  }

  function cleanup() {
    cancelReaction(reaction);
    flushDisposer(disposer);
  }

  try {
    runWithContext({ reaction, disposer }, recompute);
  } finally {
    onCleanup(cleanup);
  }
}
