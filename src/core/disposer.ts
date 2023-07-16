import "disposable-stack/auto";

export type DisposerId = number;
export type DisposeCallback = Parameters<DisposableStack["defer"]>[0];

const globalDisposerId: DisposerId = 0;

let ID: DisposerId = 0;
let isFlushing = false;
let isGlobalDisposerFlushScheduled = false;

const disposers: {
  [key: DisposerId]: DisposableStack | undefined;
} = Object.create(null);

function scheduleGlobalDisposerFlush(): void {
  if (isGlobalDisposerFlushScheduled) return;

  isGlobalDisposerFlushScheduled = true;

  setTimeout(() => {
    try {
      flushDisposer(globalDisposerId);
    } finally {
      isGlobalDisposerFlushScheduled = false;
    }
  }, 0);
}

export function createDisposer(): DisposerId {
  return ++ID;
}

export function flushDisposer(disposerId: DisposerId): void {
  const disposer = disposers[disposerId];

  if (!disposer) return;

  isFlushing = true;

  try {
    disposer.dispose();
    delete disposers[disposerId];
  } finally {
    isFlushing = false;
  }
}

export function registerDisposable(
  fn: DisposeCallback,
  disposerId?: DisposerId
): void {
  if (isFlushing) {
    fn();
    return;
  }

  if (!disposerId) {
    disposerId = globalDisposerId;
    scheduleGlobalDisposerFlush();
  }

  let disposer = disposers[disposerId];

  if (!disposer) {
    disposer = new DisposableStack();
    disposers[disposerId] = disposer;
  }

  disposer.defer(fn);
}
