import { createDisposer, flushDisposer, onCleanup } from "../core/disposer";
import { createReaction, destroyReaction } from "../core/reaction";
import { cancelReaction } from "../core/reactor";
import { runUpdate } from "../core/context";
import { untrackReaction } from "../core/tracking";

export function reactive<T>(fn: (v: T) => T, value: T): void;
export function reactive<T>(fn: (v?: T) => T | undefined): void;
export function reactive<T>(fn: (v?: T) => T, value?: T): void {
  const disposer = createDisposer();
  const reactionId = createReaction(computation);

  function computation() {
    runUpdate({ disposer, reactionId }, () => (value = fn(value)));
  }

  onCleanup(() => {
    cancelReaction(reactionId);
    untrackReaction(reactionId);
    destroyReaction(reactionId);
    flushDisposer(disposer);
  });

  computation();
}
