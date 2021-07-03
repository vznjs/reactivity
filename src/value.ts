import { createSignal, notifySignal, Signal, trackSignal } from "./signal";

/**
 * Values are the foundation of reactive system.
 * By using them, you are creating implicit dependencies for computations.
 * Once the value is updated all computations with the value as dependency will be scheduled for update as well.
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
  let signal: Signal;

  compare ??= true;

  function getter(): T | undefined {
    if (!signal) signal = createSignal();
    trackSignal(signal);
    return value;
  }

  function setter(newValue: T): void {
    if (typeof compare === "function" && compare(value, newValue)) return;

    if (compare === true && value === newValue) return;

    value = newValue;

    if (signal) notifySignal(signal);
  }

  return [getter, setter];
}
