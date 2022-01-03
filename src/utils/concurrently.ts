import { Priority, withPriority } from "../core/reactor";

export function concurrently(fn: () => any) {
  return withPriority(Priority.LowPriority, fn);
}
