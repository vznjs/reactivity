export type AtomId = number;

let ID: AtomId = 0;

export function createAtom(): AtomId {
  return ++ID;
}
