import { getContext, runWithContext } from "./context";
import { onCleanup } from "./disposer";

type Computation = () => void;

export type Signal = {
  notify(): void;
  track(): void;
};

function runComputations(computations: Set<Computation>) {
  const currentComputation = getContext().computation;

  runWithContext({ disposer: undefined, computation: undefined }, () => {
    for (const computation of computations) {
      // ? This condition will prevent circular dependencies
      // ! Updating value will never cause recalculation of current computation
      if (currentComputation === computation) return;
      computation();
    }
  });
}

export function createSignal(): Signal {
  // Buffer for next updates
  const computations = new Set<Computation>();

  // Buffer for current updates
  let currentComputations = new Set<Computation>();

  function track(): void {
    const { computation } = getContext();

    if (!computation || computations.has(computation)) return;

    computations.add(computation);

    onCleanup(() => {
      // In case there was a cleanup we want to stop any further updates of computations
      // This means nested computations will be cancelled as well
      currentComputations.delete(computation);
      computations.delete(computation);
    });
  }

  function notify(): void {
    currentComputations = new Set<Computation>(computations);
    runComputations(currentComputations);
    currentComputations.clear();
  }

  return Object.freeze({ track, notify });
}
