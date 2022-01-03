import { getContext } from "./context";

export type Disposable = () => void;
export type DisposerId = number;

let isFlushing = false;

let ID: DisposerId = 0;

const disposersRegistry: {
  [key: DisposerId]: Array<Disposable> | undefined;
} = Object.create(null);

const globalDisposerId: DisposerId = createDisposer();

function flush(): void {
  flushDisposer(globalDisposerId);
}

export function createDisposer(): DisposerId {
  return ++ID;
}

export function flushDisposer(disposerId: DisposerId): void {
  const queue = disposersRegistry[disposerId];
  if (!queue || !queue.length) return;

  isFlushing = true;

  for (const task of queue) {
    try {
      task?.();
    } catch (error) {
      setTimeout(() => {
        throw error;
      }, 0);
    }
  }

  isFlushing = false;

  delete disposersRegistry[disposerId];
}

export function onCleanup(fn: Disposable): void {
  if (isFlushing) {
    fn();
    return;
  }

  const { disposerId: disposerId } = getContext();

  if (disposerId) {
    const queue = disposersRegistry[disposerId];

    if (!queue) {
      disposersRegistry[disposerId] = [fn];
    } else if (!queue.includes(fn)) {
      queue.push(fn);
    }

    return;
  }

  const globalQueue = disposersRegistry[globalDisposerId];

  if (!globalQueue) {
    disposersRegistry[globalDisposerId] = [fn];
    setTimeout(flush, 0);
  } else if (!globalQueue.includes(fn)) {
    globalQueue.push(fn);
  }
}
