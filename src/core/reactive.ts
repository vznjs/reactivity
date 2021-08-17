import { createDisposer, flushDisposer, onCleanup } from "./disposer";
import { createReaction, flushReaction } from "./reaction";
import { cancelReaction } from "./reactor";
import { runUpdate } from "./context";

export function reactive<T>(fn: (v: T) => T, value: T): void;
export function reactive<T>(fn: (v?: T) => T | undefined): void;
export function reactive<T>(fn: (v?: T) => T, value?: T): void {
  const disposer = createDisposer();
  const reaction = createReaction(() => {
    runUpdate(disposer, reaction, () => (value = fn(value)));
  });

  onCleanup(() => {
    cancelReaction(reaction);
    flushReaction(reaction);
    flushDisposer(disposer);
  });

  reaction.compute();
}
