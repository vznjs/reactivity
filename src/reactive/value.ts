import { createAtom, triggerAtom, Atom, trackAtom } from "../core/atom";
import { getReaction } from "../core/context";

/**
 * Values are the foundation of reactive system.
 * By using them, you are creating implicit dependencies for reactions.
 * Once the value is updated all reactions with the value as dependency will be scheduled for update as well.
 *
 * @example
 * const [getCount, setCount] = createValue(0),
 * const handle = setInterval(() => setCount(getCount() + 1), 1000);
 * onCleanup(() => clearInterval(handle));
 * reactive(() => console.log(getCount()))
 *
 * @export
 * @template T
 * @returns {([() => T | undefined, <U extends T | undefined>(value?: U) => void])}
 */
export function createValue<T>(): [
  () => T | undefined,
  <U extends T | undefined>(value?: U) => void
];
export function createValue<T>(
  value: T,
  compare?: boolean | ((prev: T, next: T) => boolean)
): [() => T, (value: T) => void];
export function createValue<T>(
  value?: T,
  compare?: boolean | ((prev: T | undefined, next: T) => boolean)
): [() => T | undefined, (newValue: T) => void] {
  let atom: Atom;

  compare ??= true;

  function getter(): T | undefined {
    const reaction = getReaction();

    if (reaction) {
      atom ??= createAtom();
      trackAtom(atom, reaction);
    }

    return value;
  }

  function setter(newValue: T): void {
    if (typeof compare === "function" && compare(value, newValue)) return;

    if (compare === true && value === newValue) return;

    value = newValue;

    if (atom) triggerAtom(atom);
  }

  return [getter, setter];
}
