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
  let currentRevision = getRevision();
  let lastRevision = currentRevision;

  const atom = createAtom();
  const disposer = createDisposer();

  const reaction: Reaction = () => {
    lastRevision = getLatestRevision(reaction[ATOMS]);
    flushDisposer(disposer);
    triggerAtom(atom);
  };

  function recompute() {
    runWithContext({ reaction, disposer }, () => (memoValue = fn()));
    currentRevision = getLatestRevision(reaction[ATOMS]);
  }

  onCleanup(() => {
    const atoms = [...(reaction[ATOMS] || [])];

    cancelReaction(reaction);
    flushDisposer(disposer);

    reaction[ATOMS] = atoms;
  });

  function getter() {
    const atoms = reaction[ATOMS];

    if (!atoms) {
      reaction[ATOMS] = [];
      recompute();
    } else if (currentRevision < lastRevision) {
      recompute();
    } else if (currentRevision < getLatestRevision(atoms)) {
      flushDisposer(disposer);
      recompute();
    }

    trackAtom(atom);

    return memoValue;
  }

  return getter;
}
