import { trackAtom } from "./atom";
import { Disposer, flushDisposer } from "./disposer";
import { flushReaction, Reaction } from "./reaction";
import { Reactor } from "./reactor";

export type Context = {
  disposer?: Disposer;
  reaction?: Reaction;
  reactor?: Reactor;
};

let currentContext: Context = {};

export function getContext(): Context {
  return currentContext;
}

export function runWith<T>(context: Context, fn: () => T): T {
  const oldContext = { ...currentContext };

  if ("reaction" in context) currentContext.reaction = context.reaction;
  if ("disposer" in context) currentContext.disposer = context.disposer;
  if ("reactor" in context) currentContext.reactor = context.reactor;

  try {
    return fn();
  } finally {
    currentContext = oldContext;
  }
}

export function runUpdate<T>(context: Context, fn: () => T): T {
  const atoms = [...(context.reaction?.atoms || [])];

  if (context.reaction) flushReaction(context.reaction);
  if (context.disposer) flushDisposer(context.disposer);

  try {
    return runWith(context, fn);
  } catch (error) {
    if (context.disposer) flushDisposer(context.disposer);

    if (context.reaction && atoms.length) {
      for (let index = 0; index < atoms.length; index++) {
        trackAtom(atoms[index], context.reaction);
      }
    }

    throw error;
  }
}
