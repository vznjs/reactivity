import { createDisposer, flushDisposer, onCleanup } from "../core/disposer";
import {
  createAtom,
  getRevision,
  triggerAtom,
  Revision,
  Atom,
  trackAtom,
} from "../core/atom";
import { cancelReaction } from "../core/reactor";
import { getReaction, runComputation } from "../core/context";
import { createReaction, flushReaction } from "../core/reaction";

function getLatestRevision(atoms?: Atom[]): Revision {
  if (!atoms) return 0;
  let max = 0;

  for (let index = 0; index < atoms.length; index++) {
    const atom = atoms[index];
    if (atom.revision > max) max = atom.revision;
  }

  return max;
}

export function createMemo<T>(fn: () => T): () => T {
  let memoValue: T;
  let memoRevision = getRevision();
  let atomsRevision = memoRevision;

  const atom = createAtom();
  const disposer = createDisposer();

  const reaction = createReaction(() => {
    atomsRevision = getLatestRevision(reaction.atoms);
    triggerAtom(atom);
  });

  onCleanup(() => {
    cancelReaction(reaction);
    flushReaction(reaction);
    flushDisposer(disposer);
  });

  function getter() {
    if (
      !reaction.atoms ||
      memoRevision < atomsRevision ||
      memoRevision < getLatestRevision(reaction.atoms)
    ) {
      runComputation(disposer, reaction, () => (memoValue = fn()));
      memoRevision = getLatestRevision(reaction.atoms);
    }
    
    const currentReaction = getReaction();
    
    if (currentReaction) trackAtom(atom, currentReaction);

    return memoValue;
  }

  return getter;
}
