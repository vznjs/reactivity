import type { DisposerId } from "./disposer";
import type { ReactionId } from "./reaction";

type OwnerProps = {
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
