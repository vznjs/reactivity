export type Queue = Iterable<(() => void) | undefined>;

export function flushQueue(queue?: Queue): void {
  if (!queue) return;

  for (const task of queue) {
    try {
      if (task) task();
    } catch (error) {
      setTimeout(() => {
        throw error;
      }, 0);
    }
  }
}
