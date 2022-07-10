import type { AtomId } from "./atom";
import type { ReactionId } from "./reaction";

type Collection = { [key: number]: AtomId[] | undefined };

const reactionsAtoms: Collection = {};
const atomsReactions: Collection = {};

function untrackCollection(
  id: number,
  collection1: Collection,
  collection2: Collection
) {
  const ci1 = collection1[id];
  if (!ci1) return;

  for (let index = 0; index < ci1.length; index++) {
    const ci2 = ci1[index];
    const reactionsIds = collection2[ci2];

    if (reactionsIds) {
      if (reactionsIds.length === 1 && reactionsIds[0] === id) {
        delete collection2[ci2];
      } else {
        const index = reactionsIds.indexOf(id);
        if (index > -1) reactionsIds.splice(index, 1);
      }
    }
  }

  delete collection1[id];
}

export function getAtoms(reactionId: ReactionId): AtomId[] | undefined {
  return reactionsAtoms[reactionId];
}

export function getReactions(atomId: AtomId): ReactionId[] | undefined {
  return atomsReactions[atomId];
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

export function untrackReaction(reactionId: ReactionId, safe = false): void {
  if (safe && reactionsAtoms[reactionId]?.[0]) return;
  untrackCollection(reactionId, reactionsAtoms, atomsReactions);
}

export function untrackAtom(atomId: AtomId): void {
  untrackCollection(atomId, atomsReactions, reactionsAtoms);
}
