import { runWith } from "../core/context";
import { createDisposer, flushDisposer } from "../core/disposer";

import type { Disposable } from "../core/disposer";

export function root<T>(fn: (disposer: Disposable) => T): T {
  const disposerId = createDisposer();
  const disposer = () => flushDisposer(disposerId);

  return runWith({ disposerId, reactionId: undefined }, () => fn(disposer));
}
