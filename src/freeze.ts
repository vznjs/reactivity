import { runWithContext } from "./context";

export function freeze<T>(fn: () => T): T {
  return runWithContext({ reaction: undefined }, fn);
}
