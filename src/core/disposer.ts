import { flushQueue } from "../utils/queue";
import { getDisposer, setContext } from "./context";

export type Disposer = {
  queue?: Array<() => void>;
};

const globalDisposer: Disposer = createDisposer();

function flush(): void {
  flushDisposer(globalDisposer);
}

export function createDisposer(): Disposer {
  return {} as const;
}

export function flushDisposer(disposer: Disposer): void {
  if (!disposer.queue || !disposer.queue.length) return;
  
  setContext(undefined, undefined, () => flushQueue(disposer.queue));

  disposer.queue = undefined;
}

export function onCleanup(fn: () => void): void {
  const currentDisposer = getDisposer();

  if (currentDisposer) {
    if (!currentDisposer.queue) {
      currentDisposer.queue = [fn];
    } else if (currentDisposer.queue.indexOf(fn) === -1) {
      currentDisposer.queue.push(fn);
    }

    return;
  }

  if (!globalDisposer.queue) {
    globalDisposer.queue = [fn];
    setTimeout(flush, 0);
  } else if (globalDisposer.queue.indexOf(fn) === -1) {
    globalDisposer.queue.push(fn);
  }
}
