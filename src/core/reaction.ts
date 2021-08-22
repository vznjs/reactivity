import { Atom, untrackAtom } from "./atom";

export type Computation = () => void;

export type Reaction = {
  readonly compute: Computation;
  atoms?: Atom[];
};

export function createReaction(compute: Computation): Reaction {
  return { compute } as Reaction;
}

export function flushReaction(reaction: Reaction): void {
  if (!reaction.atoms) return;

  const atoms = [...reaction.atoms];

  for (let index = 0; index < atoms.length; index++) {
    const atom = atoms[index];
    untrackAtom(atom, reaction);
  }
}
