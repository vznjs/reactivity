import { createDisposer, flushDisposer } from "../core/disposer";
import { createAtom } from "../core/atom";
import {
  cancelReaction,
  hasScheduledReaction,
  scheduleReactions,
} from "../core/reactor";
import { getOwner } from "../core/owner";
import { createReaction, deleteReaction } from "../core/reaction";
import { getReactions, track, untrackReaction } from "../core/tracking";
import { onCleanup } from "../utils/on-cleanup";
import { runUpdate } from "../utils/run-update";

export type MemoGetter<T> = () => T;

export function createMemo<T>(fn: () => T): MemoGetter<T> {
  let memoValue: T;
  let currentIteration = 0;
  let nextIteration = 1;

  const atomId = createAtom();
  const disposerId = createDisposer();

  const reactionId = createReaction({
    compute: () => {
      scheduleReactions(getReactions(atomId));
      ++nextIteration;
    },
  });

  onCleanup(() => {
    cancelReaction(reactionId);
    untrackReaction(reactionId);
    deleteReaction(reactionId);
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

    const currentReactionId = getOwner().reactionId;
    if (currentReactionId) track(atomId, currentReactionId);

    return memoValue;
  }

  return getter;
}
