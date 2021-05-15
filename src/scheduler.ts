import { createQueue, flushQueue } from "./queue";

const scheduler = createQueue();

function flush() {
  flushQueue(scheduler)
}

export function schedule<T>(computation: () => T) {
  scheduler.add(computation);

  if (scheduler.size === 1) {
    queueMicrotask(flush);
  }
}