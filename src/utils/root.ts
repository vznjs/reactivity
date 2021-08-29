import { runWith } from "../core/context";
import { createDisposer, Disposable, flushDisposer } from "../core/disposer";

export function root<T>(fn: (disposer: Disposable) => T): T {
  const disposer = createDisposer();

  return runWith({ disposer, reaction: undefined }, () =>
    fn(() => flushDisposer(disposer))
  );
}
