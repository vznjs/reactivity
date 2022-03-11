import {
  createDisposer,
  DisposerId,
  flushDisposer,
  onCleanup,
} from "../core/disposer";
import {
  createReaction,
  destroyReaction,
  ReactionId,
  Computation,
} from "../core/reaction";
import { runUpdate } from "../core/owner";
import { cancelReaction } from "../core/reactor";
import { untrackReaction } from "../core/tracking";

type ReactiveContext<T> = {
  value: T | undefined;
  disposerId: DisposerId;
  fn: (v?: T) => T;
};

function run<T>(this: ReactiveContext<T>, reactionId: ReactionId) {
  runUpdate(
    { disposerId: this.disposerId, reactionId },
    () => (this.value = this.fn(this.value))
  );
}

export function reactive<T>(fn: (v: T) => T, value: T): void;
export function reactive<T>(fn: (v?: T) => T | undefined): void;
export function reactive<T>(fn: (v?: T) => T, value?: T): void {
  const reactiveContext: ReactiveContext<T> = {
    fn,
    value,
    disposerId: createDisposer(),
  };
  const computation = run.bind<Computation>(reactiveContext);
  const reactionId = createReaction(computation);

  onCleanup(() => {
    cancelReaction(reactionId);
    untrackReaction(reactionId);
    destroyReaction(reactionId);
    flushDisposer(reactiveContext.disposerId);
  });

  computation.call(reactiveContext, reactionId);
}
