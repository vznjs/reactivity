import { Atom, untrackAtom } from "./atom";

export type Reaction = {
  compute: () => void;
  atoms?: Atom[];
};

export function createReaction<T>(compute: () => T): Reaction {
  return { compute } as const;
}

export function flushReaction(reaction: Reaction): void {
  if (!reaction.atoms) return;

  const atoms = [...reaction.atoms!];

  for (let index = 0; index < atoms.length; index++) {
    const atom = atoms[index];
    untrackAtom(atom, reaction);
  }
}
