import { getContext } from "./context";
import { flushQueue, Queue } from "./queue";

export type Disposer = Queue;

const globalDisposer: Disposer = new Set();

function flush(): void {
  flushDisposer(globalDisposer);
}

export function flushDisposer(disposer: Disposer): void {
  flushQueue(disposer);
}

export function onCleanup(fn: () => void): void {
  const currentDisposer = getContext().disposer;

  if (currentDisposer) {
    currentDisposer.add(fn);
    return;
  }

  globalDisposer.add(fn);

  if (globalDisposer.size === 1) {
    setTimeout(flush, 0);
  }
}
