import { createDisposer, flushDisposer, onCleanup } from "../core/disposer";
import {
  createReaction,
  destroyReaction,
  getComputation,
} from "../core/reaction";
import { cancelReaction } from "../core/reactor";
import { runUpdate } from "../core/owner";
import { untrackReaction } from "../core/tracking";

export function reactive<T>(fn: (v: T) => T, value: T): void;
export function reactive<T>(fn: (v?: T) => T | undefined): void;
export function reactive<T>(fn: (v?: T) => T, value?: T): void {
  const disposerId = createDisposer();
  const reactionId = createReaction(() =>
    runUpdate({ disposerId, reactionId }, () => (value = fn(value)))
  );

  onCleanup(() => {
    cancelReaction(reactionId);
    untrackReaction(reactionId);
    destroyReaction(reactionId);
    flushDisposer(disposerId);
  });

  getComputation(reactionId)?.();
}
