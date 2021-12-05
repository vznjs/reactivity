import { flushDisposer } from "./disposer";
import { getAtoms, trackAtom, untrackReaction } from "./tracking";

import type { Reactor } from "./reactor";
import type { Disposer } from "./disposer";
import type { ReactionId } from "./reaction";

export type Context = {
  reactor?: Reactor;
  disposer?: Disposer;
  reactionId?: ReactionId;
};

let currentContext: Context = {};

export function getContext(): Context {
  return currentContext;
}

export function runWith<T>(context: Context, fn: () => T): T {
  const oldContext = { ...currentContext };

  if ("reactionId" in context) currentContext.reactionId = context.reactionId;
  if ("disposer" in context) currentContext.disposer = context.disposer;
  if ("reactor" in context) currentContext.reactor = context.reactor;

  try {
    return fn();
  } finally {
    currentContext = oldContext;
  }
}

export function runUpdate<T>(context: Context, fn: () => T): T {
  const atomsIds = context.reactionId ? getAtoms(context.reactionId) : [];

  if (context.reactionId) untrackReaction(context.reactionId);
  if (context.disposer) flushDisposer(context.disposer);

  try {
    return runWith(context, fn);
  } catch (error) {
    if (context.disposer) flushDisposer(context.disposer);

    if (context.reactionId && atomsIds.length) {
      for (let index = 0; index < atomsIds.length; index++) {
        trackAtom(atomsIds[index], context.reactionId);
      }
    }

    throw error;
  }
}
