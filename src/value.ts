import { onCleanup } from "./disposer";
import { getOwner, runWithOwner } from "./owner";

type Computation = () => void;

function runComputations(computations: Set<Computation>) {
  const currentComputation = getOwner().computation;

  runWithOwner({ disposer: undefined, computation: undefined }, () => {
    for (const computation of computations) {
      // ? This condition will prevent circular dependencies
      // ! Updating value will never cause recalculation of current computation
      if (currentComputation === computation) return;
      computation();
    };
  });
}

/**
 * Values are the foundation of reactive system.
 * By using them, you are creating implicit dependencies for computations.
 * Once the value is updated all computations with the dependency will be scheduled for update as well.
 * 
 * @example
 * const [getCount, setCount] = createValue(0),
 * const handle = setInterval(() => setCount(getCount() + 1), 1000);
 * onCleanup(() => clearInterval(handle));
 * createReaction(() => console.log(getCount()))
 *
 * @export
 * @template T
 * @returns {([() => T | undefined, <U extends T | undefined>(value?: U) => void])}
 */
export function createValue<T>(): [() => T | undefined, <U extends T | undefined>(value?: U) => void];
export function createValue<T>(
  value: T,
  compare?: boolean | ((prev: T, next: T) => boolean),
): [() => T, (value: T) => void];
export function createValue<T>(
  value?: T,
  compare?: boolean | ((prev: T | undefined, next: T) => boolean),
): [() => T | undefined, (newValue: T) => void] {
  // Buffer for next update
  const computations = new Set<Computation>();

  // Buffer for current update
  let currentComputations = new Set<Computation>();

  let currentValue = value;
  
  compare ??= true;

  function getter(): T | undefined {
    const { computation } = getOwner();

    if (computation && !computations.has(computation)) {
      computations.add(computation);

      onCleanup(() => {
        // In case there was a cleanup we want to stop any further updates of computations
        // This means nested computations will be cancelled as well
        currentComputations.delete(computation)
        computations.delete(computation)
      });
    }

    return currentValue;
  }

  function setter(newValue: T): void {
    if (typeof compare === 'function' && compare(currentValue, newValue)) return;
    if (compare === true && currentValue === newValue) return;
    
    // The new value is set ASAP in order to be usable in further called computations
    currentValue = newValue;

    // We take a snapshot to prevent infinite iteration in case of using getter() in called computations
    currentComputations = new Set<Computation>([...computations]);
    runComputations(currentComputations);
    currentComputations.clear();
  }

  return [getter, setter];
}
