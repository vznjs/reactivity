import { createDisposer, flushDisposer, onCleanup } from "./disposer";
import { runWithContext } from "./context";
import {
  createAtom,
  getRevision,
  triggerAtom,
  Revision,
  Atom,
  trackAtom,
} from "./atom";
import { Computation, ATOMS } from "./atom";
import { cancelReaction } from "./reactor";

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

  const computation: Computation = () => {
    lastRevision = getLatestRevision(computation[ATOMS]);
    flushDisposer(disposer);
    triggerAtom(atom);
  };

  function recompute() {
    runWithContext({ computation, disposer }, () => (memoValue = fn()));
    currentRevision = getLatestRevision(computation[ATOMS]);
  }

  onCleanup(() => {
    const atoms = [...(computation[ATOMS] || [])];

    cancelReaction(computation);
    flushDisposer(disposer);

    computation[ATOMS] = atoms;
  });

  function getter() {
    const atoms = computation[ATOMS];

    if (!atoms) {
      computation[ATOMS] = [];
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
