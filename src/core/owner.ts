import { flushDisposer } from "./disposer";
import { getAtoms, track, untrackReaction } from "./tracking";

import type { DisposerId } from "./disposer";
import type { ReactionId } from "./reaction";

export type Owner = {
  disposerId?: DisposerId;
  reactionId?: ReactionId;
};

let currentOwner: Owner = Object.create(null);

export function getOwner(): Owner {
  return currentOwner;
}

export function runWithOwner<T>(owner: Owner, fn: () => T): T {
  const oldOwner = { ...currentOwner };

  if ("reactionId" in owner) currentOwner.reactionId = owner.reactionId;
  if ("disposerId" in owner) currentOwner.disposerId = owner.disposerId;

  try {
    return fn();
  } finally {
    currentOwner = oldOwner;
  }
}

export function runUpdate<T>(owner: Owner, fn: () => T): T {
  const atomsIds = owner.reactionId ? getAtoms(owner.reactionId) : [];

  if (owner.reactionId) untrackReaction(owner.reactionId);
  if (owner.disposerId) flushDisposer(owner.disposerId);

  try {
    return runWithOwner(owner, fn);
  } catch (error) {
    if (owner.disposerId) flushDisposer(owner.disposerId);

    if (owner.reactionId && atomsIds.length) {
      for (let index = 0; index < atomsIds.length; index++) {
        track(atomsIds[index], owner.reactionId);
      }
    }

    throw error;
  }
}
