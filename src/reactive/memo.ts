import { createDisposer, flushDisposer, onCleanup } from "../core/disposer";
import { createAtom } from "../core/atom";
import {
  cancelReaction,
  hasScheduledReaction,
  scheduleReactions,
} from "../core/reactor";
import { getContext, runUpdate } from "../core/context";
import { createReaction, destroyReaction } from "../core/reaction";
import { getReactions, trackAtom, untrackReaction } from "../core/tracking";

export type MemoGetter<T> = () => T;

export function createMemo<T>(fn: () => T): MemoGetter<T> {
  let memoValue: T;
  let currentIteration = 0;
  let nextIteration = 1;

  const atomId = createAtom();

  const disposerId = createDisposer();
  const reactionId = createReaction(() => {
    scheduleReactions(getReactions(atomId));
    ++nextIteration;
  });

  onCleanup(() => {
    cancelReaction(reactionId);
    untrackReaction(reactionId);
    destroyReaction(reactionId);
    flushDisposer(disposerId);
  });

  function getter() {
    if (currentIteration < nextIteration) {
      runUpdate({ disposerId, reactionId }, () => (memoValue = fn()));
      currentIteration = nextIteration;
    } else if (
      currentIteration === nextIteration &&
      hasScheduledReaction(reactionId)
    ) {
      runUpdate({ disposerId, reactionId }, () => (memoValue = fn()));
      currentIteration = nextIteration + 1;
    }

    const currentReactionId = getContext().reactionId;
    if (currentReactionId) trackAtom(atomId, currentReactionId);

    return memoValue;
  }

  return getter;
}
