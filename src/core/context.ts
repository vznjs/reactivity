import { trackAtom } from "./atom";
import {
  createDisposer,
  Disposable,
  Disposer,
  flushDisposer,
} from "./disposer";
import { flushReaction, Reaction } from "./reaction";

let currentReaction: Reaction | undefined;
let currentDisposer: Disposer | undefined;

export function getReaction(): Reaction | undefined {
  return currentReaction;
}

export function getDisposer(): Disposer | undefined {
  return currentDisposer;
}

export function runWith<T>(
  disposer: Disposer | undefined,
  reaction: Reaction | undefined,
  fn: () => T
): T {
  const oldReaction = currentReaction;
  const oldDisposer = currentDisposer;

  currentReaction = reaction;
  currentDisposer = disposer;

  try {
    return fn();
  } finally {
    currentReaction = oldReaction;
    currentDisposer = oldDisposer;
  }
}

export function runUpdate<T>(
  disposer: Disposer | undefined,
  reaction: Reaction | undefined,
  fn: () => T
): T {
  const atoms = [...(reaction?.atoms || [])];

  if (reaction) flushReaction(reaction);
  if (disposer) flushDisposer(disposer);

  try {
    return runWith(disposer, reaction, fn);
  } catch (error) {
    if (disposer) flushDisposer(disposer);

    if (reaction) {
      for (let index = 0; index < atoms.length; index++) {
        trackAtom(atoms[index], reaction);
      }
    }

    throw error;
  }
}

export function freeze<T>(fn: () => T): T {
  const oldReaction = currentReaction;

  currentReaction = undefined;

  try {
    return fn();
  } finally {
    currentReaction = oldReaction;
  }
}

export function root<T>(fn: (disposer: Disposable) => T): T {
  const disposer = createDisposer();
  const oldReaction = currentReaction;
  const oldDisposer = currentDisposer;

  currentReaction = undefined;
  currentDisposer = disposer;

  try {
    return fn(() => flushDisposer(disposer));
  } finally {
    currentReaction = oldReaction;
    currentDisposer = oldDisposer;
  }
}
