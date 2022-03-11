import type { AtomId } from "./atom";
import type { ReactionId } from "./reaction";

const reactionsAtoms: { [key: ReactionId]: AtomId[] | undefined } = {};
const atomsReactions: { [key: AtomId]: ReactionId[] | undefined } = {};

export function getAtoms(reactionId: ReactionId): AtomId[] {
  return reactionsAtoms[reactionId] || [];
}

export function getReactions(atomId: AtomId): ReactionId[] {
  return atomsReactions[atomId] || [];
}

export function track(atomId: AtomId, reactionId: ReactionId): void {
  const reactionsIds = atomsReactions[atomId];
  const atomsIds = reactionsAtoms[reactionId];

  if (!reactionsIds) {
    atomsReactions[atomId] = [reactionId];
  } else if (!reactionsIds.includes(reactionId)) {
    reactionsIds.push(reactionId);
  }

  if (!atomsIds) {
    reactionsAtoms[reactionId] = [atomId];
  } else if (!atomsIds.includes(atomId)) {
    atomsIds.push(atomId);
  }
}

export function untrack(atomId: AtomId, reactionId: ReactionId): void {
  const reactionsIds = atomsReactions[atomId];
  const atomsIds = reactionsAtoms[reactionId];

  if (reactionsIds) {
    if (reactionsIds.length === 1 && reactionsIds[0] === reactionId) {
      delete atomsReactions[atomId];
    } else {
      const index = reactionsIds.indexOf(reactionId);
      if (index > -1) reactionsIds.splice(index, 1);
    }
  }

  if (atomsIds) {
    if (atomsIds.length === 1 && atomsIds[0] === reactionId) {
      delete reactionsAtoms[reactionId];
    } else {
      const index = atomsIds.indexOf(atomId);
      if (index > -1) atomsIds.splice(index, 1);
    }
  }
}

export function untrackReaction(reactionId: ReactionId): void {
  const atomsIds = reactionsAtoms[reactionId];
  if (!atomsIds) return;

  for (let index = 0; index < atomsIds.length; index++) {
    const atomId = atomsIds[index];
    const reactionsIds = atomsReactions[atomId];

    if (reactionsIds) {
      if (reactionsIds.length === 1 && reactionsIds[0] === reactionId) {
        delete atomsReactions[atomId];
      } else {
        const index = reactionsIds.indexOf(reactionId);
        if (index > -1) reactionsIds.splice(index, 1);
      }
    }
  }

  delete reactionsAtoms[reactionId];
}
