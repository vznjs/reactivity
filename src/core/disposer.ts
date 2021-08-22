import { flushQueue } from "../utils/queue";
import { getDisposer } from "./context";

let isFlushing = false;

export type Disposable = () => void;

export type Disposer = {
  queue?: Array<Disposable>;
};

const globalDisposer: Disposer = createDisposer();

function flush(): void {
  flushDisposer(globalDisposer);
}

export function createDisposer(): Disposer {
  return {} as Disposer;
}

export function flushDisposer(disposer: Disposer): void {
  if (!disposer.queue || !disposer.queue.length) return;

  isFlushing = true;
  flushQueue(disposer.queue);
  isFlushing = false;

  disposer.queue = undefined;
}

export function onCleanup(fn: Disposable): void {
  if (isFlushing) {
    fn();
    return;
  }

  const currentDisposer = getDisposer();

  if (currentDisposer) {
    if (!currentDisposer.queue) {
      currentDisposer.queue = [fn];
    } else if (!currentDisposer.queue.includes(fn)) {
      currentDisposer.queue.push(fn);
    }

    return;
  }

  if (!globalDisposer.queue) {
    globalDisposer.queue = [fn];
    setTimeout(flush, 0);
  } else if (!globalDisposer.queue.includes(fn)) {
    globalDisposer.queue.push(fn);
  }
}
