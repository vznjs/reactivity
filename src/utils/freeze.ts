import { runWithOwner } from "../core/owner";

export function freeze<T>(fn: () => T): T {
  return runWithOwner({ reactionId: undefined }, fn);
}
