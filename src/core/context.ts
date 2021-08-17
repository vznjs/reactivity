import { trackAtom } from "./atom";
import { createDisposer, Disposer, flushDisposer } from "./disposer";
import { flushReaction, Reaction } from "./reaction";

let reaction: Reaction | undefined;
let disposer: Disposer | undefined;

export function getReaction(): Reaction | undefined {
  return reaction;
}

export function getDisposer(): Disposer | undefined {
  return disposer;
}

export function runWith<T>(
  newDisposer: Disposer | undefined,
  newReaction: Reaction | undefined,
  fn: () => T
): T {
  const currentReaction = reaction;
  const currentDisposer = disposer;

  reaction = newReaction;
  disposer = newDisposer;

  try {
    return fn();
  } finally {
    reaction = currentReaction;
    disposer = currentDisposer;
  }
}

export function runUpdate<T>(
  newDisposer: Disposer | undefined,
  newReaction: Reaction | undefined,
  fn: () => T
): T {
  const atoms = [...(newReaction?.atoms || [])];

  if (newReaction) flushReaction(newReaction);
  if (newDisposer) flushDisposer(newDisposer);

  const currentReaction = reaction;
  const currentDisposer = disposer;

  reaction = newReaction;
  disposer = newDisposer;

  try {
    return fn();
  } catch (error) {
    if (disposer) flushDisposer(disposer);

    if (reaction) {
      for (let index = 0; index < atoms.length; index++) {
        trackAtom(atoms[index], reaction);
      }
    }

    throw error;
  } finally {
    reaction = currentReaction;
    disposer = currentDisposer;
  }
}

export function freeze<T>(fn: () => T): T {
  const currentReaction = reaction;

  reaction = undefined;

  try {
    return fn();
  } finally {
    reaction = currentReaction;
  }
}

export function root<T>(fn: (disposer: () => void) => T): T {
  const newDisposer = createDisposer();
  const currentReaction = reaction;
  const currentDisposer = disposer;

  reaction = undefined;
  disposer = newDisposer;

  try {
    return fn(() => flushDisposer(newDisposer));
  } finally {
    reaction = currentReaction;
    disposer = currentDisposer;
  }
}
