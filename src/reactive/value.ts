import { scheduleAtom } from "..";
import { createAtom } from "../core/atom";
import { getContext } from "../core/context";
import { trackAtom } from "../core/tracking";

import type { AtomId } from "../core/atom";

export type ValueGetter<T> = () => T;
export type ValueSetter<T> = (newValue: T) => void;

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
 */
export function createValue<T>(): [ValueGetter<T | undefined>, ValueSetter<T>];
export function createValue<T>(
  value: T,
  compare?: boolean | ((prev: T, next: T) => boolean)
): [ValueGetter<T>, ValueSetter<T>];
export function createValue<T>(
  value?: T,
  compare?: boolean | ((prev: T | undefined, next: T) => boolean)
): [ValueGetter<T | undefined>, ValueSetter<T>] {
  let atomId: AtomId;

  compare ??= true;

  function valueGetter(): T | undefined {
    const { reactionId } = getContext();

    if (reactionId) {
      atomId ??= createAtom();
      trackAtom(atomId, reactionId);
    }

    return value;
  }

  function valueSetter(newValue: T): void {
    if (typeof compare === "function" && compare(value, newValue)) return;

    if (compare === true && value === newValue) return;

    value = newValue;

    if (atomId) scheduleAtom(atomId);
  }

  return [valueGetter, valueSetter];
}
