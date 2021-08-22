import { createDisposer, flushDisposer, onCleanup } from "../core/disposer";
import { createReaction, flushReaction } from "../core/reaction";
import { cancelReaction } from "../core/reactor";
import { runUpdate } from "../core/context";

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
