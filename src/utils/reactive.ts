import {
  createDisposer,
  DisposerId,
  flushDisposer,
  onCleanup,
} from "../core/disposer";
import {
  Computation,
  createReaction,
  destroyReaction,
  ReactionContext,
  ReactionId,
  runReaction,
} from "../core/reaction";
import { runUpdate } from "../core/owner";
import { cancelReaction } from "../core/reactor";
import { untrackReaction } from "../core/tracking";

interface ReactiveContext<T> extends ReactionContext {
  value: T | undefined;
  disposerId: DisposerId;
  fn: (v?: T) => T;
  compute: Computation;
}

function compute<T>(this: ReactiveContext<T>, reactionId: ReactionId) {
  runUpdate(
    { disposerId: this.disposerId, reactionId },
    () => (this.value = this.fn(this.value))
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
    destroyReaction(reactionId);
    flushDisposer(disposerId);
  });

  runReaction(reactionId);
}
