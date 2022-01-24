import { runWithContext } from "../core/context";
import { createDisposer, flushDisposer } from "../core/disposer";

import type { Disposable } from "../core/disposer";

export function root<T>(fn: (disposer: Disposable) => T): T {
  const disposerId = createDisposer();
  const disposer = () => flushDisposer(disposerId);

  return runWithContext({ disposerId, reactionId: undefined }, () =>
    fn(disposer)
  );
}
