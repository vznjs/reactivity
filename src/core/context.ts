import type { Reaction } from "./atom";
import { createDisposer, Disposer, flushDisposer } from "./disposer";

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

export function freeze<T>(fn: () => T): T {
  return runWithContext({ reaction: undefined }, fn);
}

/**
 * Reactions created by root will live until dispose is called
 *
 * @export
 * @template T
 * @param {(disposer: () => void) => T} fn
 * @returns {T}
 */
export function root<T>(fn: (disposer: () => void) => T): T {
  const disposer = createDisposer();

  return runWithContext({ disposer, reaction: undefined }, () =>
    fn(() => flushDisposer(disposer))
  );
}
