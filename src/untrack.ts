import { runWithOwner } from "./owner";

export function untrack<T>(fn: () => T): T {
  return runWithOwner({ computation: undefined }, fn);
}