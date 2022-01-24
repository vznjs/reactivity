import { Priority, runWithPriority } from "../core/reactor";

export function concurrently(fn: () => any) {
  return runWithPriority(Priority.LowPriority, fn);
}
