type Queue = Array<() => void> | Set<() => void>;

export function flushQueue(queue: Queue = []): void {
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
