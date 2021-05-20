import { runWithContext } from "./context";

export function untrack<T>(fn: () => T): T {
  return runWithContext({ computation: undefined }, fn);
}
