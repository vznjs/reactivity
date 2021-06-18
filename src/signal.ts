import { getContext } from "./context";
import { onCleanup } from "./disposer";
import { scheduleUpdate } from "./scheduler";

export const SIGNALS = Symbol("SIGNALS");

export type Computation = {
  (): void;
  [SIGNALS]?: Set<Signal>;
};

export type Revision = number;

let CURRENT_REVISION: Revision = 0;

export type Signal = {
  track(): void;
  notify(): void;
  get revision(): Revision;
};

export function getRevision(): Revision {
  return CURRENT_REVISION;
}

export function createSignal(): Signal {
  const computations = new Set<Computation>();
  let revision = CURRENT_REVISION;

  function track(): void {
    const { computation } = getContext();

    if (computation && !computations.has(computation)) {
      computations.add(computation);
      computation[SIGNALS]?.add(signal);
  
      onCleanup(() => {
        computations.delete(computation);
        computation[SIGNALS]?.delete(signal);
      });
    };
  }

  function notify(): void {
    if (computations.size) {
      revision = ++CURRENT_REVISION;
      scheduleUpdate(signal, [...computations]);
    }
  }

  const signal = {
    track,
    notify,
    get revision() {
      return revision;
    },
  } as const;

  return signal;
}
