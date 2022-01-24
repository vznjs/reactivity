import { runWithContext } from "../core/context";

export function freeze<T>(fn: () => T): T {
  return runWithContext({ reactionId: undefined }, fn);
}
