import { flushReaction, Reaction } from "./core/atom";
import { runReaction } from "./core/context";
import { createDisposer, flushDisposer, onCleanup } from "./core/disposer";
import { cancelReaction } from "./core/reactor";

export function reactive<T>(fn: (v: T) => T, value: T): void;
export function reactive<T>(fn: (v?: T) => T | undefined): void;
export function reactive<T>(fn: (v?: T) => T, value?: T): void {
  const disposer = createDisposer();

  let reaction: Reaction = () => {
    reaction = runReaction({ reaction, disposer }, () => (value = fn(value)));
  };

  onCleanup(() => {
    cancelReaction(reaction);
    flushReaction(reaction);
    flushDisposer(disposer);
  });

  reaction();
}
