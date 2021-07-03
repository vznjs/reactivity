import { getContext } from "./context";
import { onCleanup } from "./disposer";
import { scheduleUpdate } from "./scheduler";

export const SIGNALS = Symbol("SIGNALS");

let CLOCK: Revision = 0;

export type Computation = {
  (): void;
  [SIGNALS]?: Set<Signal>;
};

export type Revision = number;

export type Signal = {
  computations?: Computation[];
  revision: Revision;
};

export function getRevision(): Revision {
  return CLOCK;
}

export function trackSignal(signal: Signal): void {
  const { computation } = getContext();

  if (!computation) return;
  if (signal.computations?.includes(computation)) return;

  if (signal.computations) {
    signal.computations.push(computation);
  } else {
    signal.computations = [computation];
  }

  computation[SIGNALS]?.add(signal);

  onCleanup(() => {
    if (signal.computations) {
      const index = signal.computations.indexOf(computation);
      signal.computations.splice(index, 1);
    }
    computation[SIGNALS]?.delete(signal);
  });
}

export function notifySignal(signal: Signal): void {
  signal.revision = ++CLOCK;

  if (signal.computations?.length) {
    scheduleUpdate(signal, signal.computations);
  }
}

export function createSignal(): Signal {
  return {
    revision: CLOCK,
  } as const;
}