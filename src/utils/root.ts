import { createOwner, runWithOwner } from "../core/owner";
import { createDisposer, flushDisposer } from "../core/disposer";

export function root<T>(fn: (disposer: () => void) => T): T {
  const disposerId = createDisposer();
  const disposer = () => flushDisposer(disposerId);

  return runWithOwner(createOwner({ disposerId, reactionId: undefined }), () =>
    fn(disposer)
  );
}
