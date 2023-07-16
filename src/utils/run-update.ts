import {
  Owner,
  getAtoms,
  untrackReaction,
  flushDisposer,
  runWithOwner,
  track,
} from "..";

export function runUpdate<T>(owner: Owner, fn: () => T): T {
  let atomsIds;
  if (owner.reactionId) atomsIds = getAtoms(owner.reactionId);

  if (owner.reactionId) untrackReaction(owner.reactionId);
  if (owner.disposerId) flushDisposer(owner.disposerId);

  try {
    return runWithOwner(owner, fn);
  } catch (error) {
    if (owner.disposerId) flushDisposer(owner.disposerId);

    if (owner.reactionId && atomsIds) {
      for (let index = 0; index < atomsIds.length; index++) {
        track(atomsIds[index], owner.reactionId);
      }
    }

    throw error;
  }
}
