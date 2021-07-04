import { getContext } from "./context";
import { onCleanup } from "./disposer";
import { scheduleReactions } from "./reactor";

export const ATOMS = Symbol("ATOMS");

let CLOCK: Revision = 0;

export type Reaction = {
  (): void;
  [ATOMS]?: Atom[];
};

export type Revision = number;

export type Atom = {
  reactions?: Reaction[];
  revision: Revision;
};

export function getRevision(): Revision {
  return CLOCK;
}

export function trackAtom(atom: Atom): void {
  const { reaction } = getContext();

  if (!reaction) return;
  if (atom.reactions?.includes(reaction)) return;

  if (atom.reactions) {
    atom.reactions.push(reaction);
  } else {
    atom.reactions = [reaction];
  }

  reaction[ATOMS]?.push(atom);

  onCleanup(() => {
    if (atom.reactions) {
      const index = atom.reactions.indexOf(reaction);
      atom.reactions.splice(index, 1);
    }

    if (reaction[ATOMS]) {
      const index = reaction[ATOMS]!.indexOf(atom);
      if (index > -1) reaction[ATOMS]?.splice(index, 1);
    }
  });
}

export function triggerAtom(atom: Atom): void {
  atom.revision = ++CLOCK;

  if (atom.reactions?.length) {
    scheduleReactions(atom, atom.reactions);
  }
}

export function createAtom(): Atom {
  return {
    revision: CLOCK,
  } as const;
}