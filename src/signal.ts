import { getContext } from "./context";
import { onCleanup } from "./disposer";
import { scheduleUpdate } from "./scheduler";

export type Computation = () => void;

export type Signal = {
  track(): void;
  notify(): void;
};

export function createSignal(): Signal {
  const computations = new Set<Computation>();

  function track(): void {
    const { computation } = getContext();

    if (!computation || computations.has(computation)) return;

    computations.add(computation);

    onCleanup(() => {
      computations.delete(computation);
    });
  }

  function notify(): void {
    scheduleUpdate(signal, [...computations]);
  }

  const signal = Object.freeze({ track, notify });
  
  return signal;
}
