import { flushDisposer } from "./disposer";
import { getAtoms, track, untrackReaction } from "./tracking";

import type { DisposerId } from "./disposer";
import type { ReactionId } from "./reaction";

type OwnerProps = {
  parent?: Owner;
  disposerId?: DisposerId;
  reactionId?: ReactionId;
};

export type Owner = { parent?: Owner } & OwnerProps;

let currentOwner: Owner = {};

export function createOwner(ownerProps?: OwnerProps): Owner {
  const parent = getOwner();
  return {
    reactionId: parent.reactionId,
    disposerId: parent.disposerId,
    ...ownerProps,
    parent,
  };
}

export function getOwner(): Owner {
  return currentOwner;
}

export function runWithOwner<T>(owner: Owner, fn: () => T): T {
  const prevOwner = currentOwner;

  currentOwner = owner;

  try {
    return fn();
  } finally {
    currentOwner = prevOwner;
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
