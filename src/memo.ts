import { createDisposer, flushDisposer, onCleanup } from "./core/disposer";
import { runWithContext } from "./core/context";
import {
  createAtom,
  getRevision,
  triggerAtom,
  Revision,
  Atom,
  trackAtom,
} from "./core/atom";
import { Reaction, ATOMS } from "./core/atom";
import { cancelReaction } from "./core/reactor";

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

  const reaction: Reaction = () => {
    atomsRevision = getLatestRevision(reaction[ATOMS]);
    flushDisposer(disposer);
    triggerAtom(atom);
  };

  function recompute() {
    reaction[ATOMS] = [];
    runWithContext({ reaction, disposer }, () => (memoValue = fn()));
    memoRevision = getLatestRevision(reaction[ATOMS]);
  }

  onCleanup(() => {
    reaction[ATOMS] = undefined;
    cancelReaction(reaction);
    flushDisposer(disposer);
  });

  function getter() {
    if (!reaction[ATOMS] || memoRevision < atomsRevision) {
      recompute();
    } else if (memoRevision < getLatestRevision(reaction[ATOMS])) {
      flushDisposer(disposer);
      recompute();
    }

    trackAtom(atom);

    return memoValue;
  }

  return getter;
}
