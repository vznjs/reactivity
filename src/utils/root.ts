import { runWith } from "../core/context";
import { createDisposer, flushDisposer } from "../core/disposer";

import type { Disposable } from "../core/disposer";

export function root<T>(fn: (disposer: Disposable) => T): T {
  const disposer = createDisposer();

  return runWith({ disposer, reactionId: undefined }, () =>
    fn(() => flushDisposer(disposer))
  );
}
