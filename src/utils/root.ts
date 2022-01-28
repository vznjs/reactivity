import { runWithOwner } from "../core/owner";
import { createDisposer, flushDisposer } from "../core/disposer";

import type { Disposable } from "../core/disposer";

export function root<T>(fn: (disposer: Disposable) => T): T {
  const disposerId = createDisposer();
  const disposer = () => flushDisposer(disposerId);

  return runWithOwner({ disposerId, reactionId: undefined }, () =>
    fn(disposer)
  );
}
