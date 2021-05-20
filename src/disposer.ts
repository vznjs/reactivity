import { getContext } from "./context";
import { createQueue, flushQueue } from "./queue";

const disposer = createQueue();

function flush() {
  flushQueue(disposer);
}

export function onCleanup(fn: () => void): void {
  (getContext().disposer || disposer).add(fn);

  if (disposer.size === 1) {
    setTimeout(flush, 0);
  }
}
