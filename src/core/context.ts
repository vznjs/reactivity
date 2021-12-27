import { flushDisposer } from "./disposer";
import { getAtoms, track, untrackReaction } from "./tracking";

import type { Reactor } from "./reactor";
import type { DisposerId } from "./disposer";
import type { ReactionId } from "./reaction";

export type Context = {
  reactor?: Reactor;
  disposerId?: DisposerId;
  reactionId?: ReactionId;
};

let currentContext: Context = Object.create(null);

export function getContext(): Context {
  return currentContext;
}

export function runWith<T>(context: Context, fn: () => T): T {
  const oldContext = { ...currentContext };

  if ("reactionId" in context) currentContext.reactionId = context.reactionId;
  if ("disposerId" in context) currentContext.disposerId = context.disposerId;
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
  if (context.disposerId) flushDisposer(context.disposerId);

  try {
    return runWith(context, fn);
  } catch (error) {
    if (context.disposerId) flushDisposer(context.disposerId);

    if (context.reactionId && atomsIds.length) {
      for (let index = 0; index < atomsIds.length; index++) {
        track(atomsIds[index], context.reactionId);
      }
    }

    throw error;
  }
}
