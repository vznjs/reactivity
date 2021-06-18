import { getContext } from "./context";
import { flushQueue, Queue } from "./queue";

const disposer: Queue = new Set();

function flush() {
  flushQueue(disposer);
}

export function onCleanup(fn: () => void): void {
  const currentDisposer = getContext().disposer;

  if (currentDisposer) {
    currentDisposer.add(fn);
  } else {
    disposer.add(fn);

    if (disposer.size === 1) {
      setTimeout(flush, 0);
    }
  }
}
