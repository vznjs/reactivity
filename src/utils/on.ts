import { freeze } from "../core/context";

export function on<T>(
  atom: Array<() => any> | (() => any),
  fn: (value?: T) => T,
  defer = false
): (value?: T) => T | undefined {
  const isArray = Array.isArray(atom);

  return (value: T | undefined) => {
    if (isArray) {
      for (let i = 0; i < atom.length; i++) {
        (atom as Array<() => any>)[i]();
      }
    } else {
      (atom as () => T)();
    }

    if (defer) {
      defer = false;
      // this aspect of first run on deferred is hidden from end user and should not affect types
      return undefined as unknown as T;
    }

    return freeze(() => fn(value));
  };
}
