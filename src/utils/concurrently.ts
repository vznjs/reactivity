import { Priority, runWithPriority } from "../core/reactor";

export function concurrently<T>(fn: () => T) {
  return runWithPriority(Priority.LowPriority, fn);
}
