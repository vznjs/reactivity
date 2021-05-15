import { getOwner } from "./owner";
import { createQueue, flushQueue } from "./queue";

const disposer = createQueue();

function flush() {
  flushQueue(disposer)
}

export function onCleanup(fn: () => void): void {
  (getOwner().disposer || disposer).add(fn);

  if (disposer.size === 1) {
    setTimeout(flush, 0);
  }
}