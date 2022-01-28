import { createOwner, runWithOwner } from "../core/owner";

export function freeze<T>(fn: () => T): T {
  return runWithOwner(createOwner({ reactionId: undefined }), fn);
}
