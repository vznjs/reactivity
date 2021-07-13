import { getContext, runWithContext } from "./context";
import { scheduleAtomReactions } from "./reactor";

export type Revision = number;

let CLOCK: Revision = 0;

export function getRevision(): Revision {
  return CLOCK;
}

export const ATOMS = Symbol("ATOMS");

export type Atom = {
  reactions?: Reaction[];
  revision: Revision;
};

export type Reaction = {
  (): void;
  [ATOMS]?: Atom[];
};

export function flushReaction(reaction: Reaction) {
  if (!reaction[ATOMS]) return;

  runWithContext({ reaction }, () => {
    for (let index = 0; index < reaction[ATOMS]!.length; index++) {
      const atom = reaction[ATOMS]![index];
      untrackAtom(atom);
    }
  });
}

export function trackAtom(atom: Atom): void {
  const { reaction } = getContext();

  if (!reaction) return;
  if (atom.reactions?.includes(reaction)) return;

  atom.reactions
    ? atom.reactions.push(reaction)
    : (atom.reactions = [reaction]);

  reaction[ATOMS] ? reaction[ATOMS]!.push(atom) : (reaction[ATOMS] = [atom]);
}

export function untrackAtom(atom: Atom): void {
  const { reaction } = getContext();

  if (!reaction) return;

  if (atom.reactions) {
    const index = atom.reactions.indexOf(reaction);
    if (index > -1) atom.reactions.splice(index, 1);
  }

  if (reaction[ATOMS]) {
    const index = reaction[ATOMS]!.indexOf(atom);
    if (index > -1) reaction[ATOMS]!.splice(index, 1);
  }
}

export function triggerAtom(atom: Atom): void {
  atom.revision = ++CLOCK;
  scheduleAtomReactions(atom);
}

export function createAtom(): Atom {
  return {
    revision: CLOCK,
  } as const;
}
