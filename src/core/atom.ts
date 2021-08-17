import { Reaction } from "./reaction";
import { scheduleAtom } from "./reactor";

export type Revision = number;

let CLOCK: Revision = 0;

export function getRevision(): Revision {
  return CLOCK;
}

export type Atom = {
  reactions?: Reaction[];
  revision: Revision;
};

export function createAtom(): Atom {
  return {
    revision: CLOCK,
  } as const;
}

export function triggerAtom(atom: Atom): void {
  atom.revision = ++CLOCK;
  scheduleAtom(atom);
}

export function trackAtom(atom: Atom, reaction: Reaction): void {
  if (atom.reactions) {
    if (atom.reactions.includes(reaction)) return;
    atom.reactions.push(reaction);
  } else {
    atom.reactions = [reaction];
  }

  if (reaction.atoms) {
    if (reaction.atoms.includes(atom)) return;
    reaction.atoms.push(atom);
  } else {
    reaction.atoms = [atom];
  }
}

export function untrackAtom(atom: Atom, reaction: Reaction): void {
  if (!reaction) return;

  if (atom.reactions) {
    const index = atom.reactions.indexOf(reaction);
    if (index > -1) atom.reactions.splice(index, 1);
  }

  if (reaction.atoms) {
    const index = reaction.atoms.indexOf(atom);
    if (index > -1) reaction.atoms.splice(index, 1);
  }
}
