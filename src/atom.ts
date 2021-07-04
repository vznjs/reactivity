import { getContext } from "./context";
import { onCleanup } from "./disposer";
import { scheduleReactions } from "./reactor";

export const ATOMS = Symbol("ATOMS");

let CLOCK: Revision = 0;

export type Computation = {
  (): void;
  [ATOMS]?: Atom[];
};

export type Revision = number;

export type Atom = {
  computations?: Computation[];
  revision: Revision;
};

export function getRevision(): Revision {
  return CLOCK;
}

export function trackAtom(atom: Atom): void {
  const { computation } = getContext();

  if (!computation) return;
  if (atom.computations?.includes(computation)) return;

  if (atom.computations) {
    atom.computations.push(computation);
  } else {
    atom.computations = [computation];
  }

  computation[ATOMS]?.push(atom);

  onCleanup(() => {
    if (atom.computations) {
      const index = atom.computations.indexOf(computation);
      atom.computations.splice(index, 1);
    }

    if (computation[ATOMS]) {
      const index = computation[ATOMS]!.indexOf(atom);
      if (index > -1) computation[ATOMS]?.splice(index, 1);
    }
  });
}

export function triggerAtom(atom: Atom): void {
  atom.revision = ++CLOCK;

  if (atom.computations?.length) {
    scheduleReactions(atom, atom.computations);
  }
}

export function createAtom(): Atom {
  return {
    revision: CLOCK,
  } as const;
}