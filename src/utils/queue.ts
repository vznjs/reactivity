export type Queue = Iterable<() => void>;

export function flushQueue(queue?: Queue): void {
  if (!queue) return;

  for (const task of queue) {
    try {
      task();
    } catch (error) {
      setTimeout(() => {
        throw error;
      }, 0);
    }
  }
}
