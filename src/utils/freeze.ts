import { runWith } from "../core/context";

export function freeze<T>(fn: () => T): T {
  return runWith({ reactionId: undefined }, fn);
}
