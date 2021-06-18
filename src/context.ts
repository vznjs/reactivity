import type { Computation } from "./signal";
import type { Queue } from "./queue";

export interface Context {
  disposer?: Queue;
  computation?: Computation;
}

const context: Context = {};

export function getContext(): Context {
  return context;
}

export function runWithContext<T>(newContext: Context, fn: () => T): T {
  const currentDisposer = context.disposer;
  const currentComputation = context.computation;

  context.disposer = newContext.disposer;
  context.computation = newContext.computation;

  try {
    return fn();
  } finally {
    context.disposer = currentDisposer;
    context.computation = currentComputation;
  }
}