import { flushReaction, Reaction } from "./atom";
import { createDisposer, Disposer, flushDisposer } from "./disposer";

export interface Context {
  disposer?: Disposer;
  reaction?: Reaction;
}

let context: Context = {};

export function getContext(): Context {
  return context;
}

export function runWithContext<T>(newContext: Context, fn: () => T): T {
  const currentContext = context;

  context = newContext;

  try {
    return fn();
  } finally {
    context = currentContext;
  }
}

export function runReaction<T>(context: Context, fn: () => T): Reaction {
  if (context.disposer) flushDisposer(context.disposer);

  const newReaction = () => context.reaction?.();

  try {
    runWithContext({ reaction: newReaction, disposer: context.disposer }, fn);
  } catch (error) {
    if (context.disposer) flushDisposer(context.disposer);
    flushReaction(newReaction);
    throw error;
  }

  if (context.reaction) flushReaction(context.reaction);

  return newReaction;
}

export function freeze<T>(fn: () => T): T {
  return runWithContext({ disposer: context.disposer }, fn);
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

  return runWithContext({ disposer }, () => fn(() => flushDisposer(disposer)));
}
