import type { Reaction } from "./atom";
import type { Disposer } from "./disposer";

export interface Context {
  disposer?: Disposer;
  reaction?: Reaction;
}

const context: Context = {};

export function getContext(): Context {
  return context;
}

export function runWithContext<T>(newContext: Context, fn: () => T): T {
  const currentDisposer = context.disposer;
  const currentReaction = context.reaction;

  if ("disposer" in newContext) context.disposer = newContext.disposer;
  if ("reaction" in newContext) context.reaction = newContext.reaction;

  try {
    return fn();
  } finally {
    context.disposer = currentDisposer;
    context.reaction = currentReaction;
  }
}
