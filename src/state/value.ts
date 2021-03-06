import { createAtom } from "../core/atom";
import { getOwner } from "../core/owner";
import { getReactions, track, untrackAtom } from "../core/tracking";

import type { AtomId } from "../core/atom";
import { scheduleReactions } from "../core/reactor";

export type ValueGetter<T> = () => T;
export type ValueSetter<T> = (newValue: T) => void;

type ValueContext<T> = {
  atomId?: AtomId;
  value?: T;
  compare?: undefined | boolean | ((prev: T | undefined, next: T) => boolean);
};

const registry = new FinalizationRegistry((id: AtomId) => untrackAtom(id));

function valueGetter<T>(this: ValueContext<T>): T | undefined {
  const { reactionId } = getOwner();

  if (reactionId) {
    if (!this.atomId) {
      this.atomId = createAtom();
      registry.register(this, this.atomId);
    }

    track(this.atomId, reactionId);
  }

  return this.value;
}

function valueSetter<T>(this: ValueContext<T>, newValue: T): void {
  if (typeof this.compare === "function" && this.compare(this.value, newValue))
    return;

  if (
    (this.compare === undefined || this.compare === true) &&
    this.value === newValue
  )
    return;

  this.value = newValue;

  if (this.atomId) scheduleReactions(getReactions(this.atomId));
}

export function createValue<T>(): [ValueGetter<T | undefined>, ValueSetter<T>];
export function createValue<T>(
  value: T,
  compare?: boolean | ((prev: T, next: T) => boolean)
): [ValueGetter<T>, ValueSetter<T>];
export function createValue<T>(
  value?: T,
  compare?: boolean | ((prev: T | undefined, next: T) => boolean)
): [ValueGetter<T | undefined>, ValueSetter<T>] {
  const valueContext: ValueContext<T> = { value, compare };

  return [
    valueGetter.bind<ValueGetter<T | undefined>>(valueContext),
    valueSetter.bind<ValueSetter<T>>(valueContext),
  ];
}
