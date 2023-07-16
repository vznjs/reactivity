import { createDisposer, DisposerId, flushDisposer } from "../core/disposer";
import {
  Computation,
  createReaction,
  deleteReaction,
  ReactionContext,
  ReactionId,
  runReaction,
} from "../core/reaction";
import { cancelReaction } from "../core/reactor";
import { untrackReaction } from "../core/tracking";
import { onCleanup } from "./on-cleanup";
import { runUpdate } from "./run-update";

interface ReactiveContext<T> extends ReactionContext {
  value: T | undefined;
  disposerId: DisposerId;
  fn: (v?: T) => T;
  compute: Computation;
}

function compute<T>(this: ReactiveContext<T>, reactionId: ReactionId) {
  runUpdate(
    { disposerId: this.disposerId, reactionId },
    () => (this.value = this.fn(this.value)),
  );
  // this.value = this.fn(this.value);
}

export function reactive<T>(fn: (v: T) => T, value: T): void;
export function reactive<T>(fn: (v?: T) => T | undefined): void;
export function reactive<T>(fn: (v?: T) => T, value?: T): void {
  const disposerId = createDisposer();
  const reactionId = createReaction({
    fn,
    compute,
    value,
    disposerId,
  });

  onCleanup(() => {
    cancelReaction(reactionId);
    untrackReaction(reactionId);
    deleteReaction(reactionId);
    flushDisposer(disposerId);
  });

  runReaction(reactionId);
}
