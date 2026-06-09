// VZN | Reactivity — the whole library in one file.
//
// alien-signals' `index.ts` (the node operators over its `createReactiveSystem`
// engine) held as close to the original as possible, keeping alien's names. The
// only changes are marked `// VZN:`. They restore VZN's ownership/disposal model
// on top of alien's graph:
//
//   * `signal` is alien's verbatim; `trigger(fn)` invalidates the signals read
//     inside `fn` without changing their values (forcing subscribers to refresh);
//   * writes schedule effects on a microtask (async batching); `flushSync` /
//     `batch` / `flushSync` are the synchronous escapes;
//   * effects take a `() => void | (() => void)` — register cleanups via `onCleanup`
//     and/or by returning a teardown fn; disposal flows through ownership (a `root`,
//     or the auto-disposed global owner), and they ALSO return a disposer that tears
//     the effect down early (running its cleanups);
//   * effects, scopes AND computeds are owners: they support imperative
//     `onCleanup`, run before each re-run, on dispose, and when the body throws;
//   * cleanup ownership (`activeOwner`) is decoupled from tracking (`activeSub`)
//     so `onCleanup` keeps working inside `untrack`;
//   * un-rooted reactivity is collected by a `globalOwner` disposed on the next
//     macrotask (so top-level reactivity is one-shot unless wrapped in `root`);
//   * `untrack` runs without tracking.

// ReactiveFlags — alien's node-state bitflags, hardcoded as literals (the
// toolchain's erasable-syntax rule forbids `enum`/`const enum`; literals also
// inline like alien's compiled output, e.g. `flags & 16`). Legend:
//
//   0   None           no state
//   1   Mutable        can produce/recompute a value (signals, computeds)
//   2   Watching       is an effect/watcher — gets queued & notified on change
//   4   RecursedCheck  currently running (its tracking window) — re-entrancy guard
//   8   Recursed       reached again while already pending — needs a re-check
//   16  Dirty          known stale — must recompute
//   32  Pending        maybe stale (a transitive dep changed) — confirm via checkDirty
//   64  HasChildEffect parent (effect/scope/computed) owns at least one child effect

import { createReactiveSystem } from "alien-signals/system";

import type { ReactiveNode } from "alien-signals/system";

export type CleanupFn = () => void;

// VZN: an error handler. Always receives a normalized `Error` (see `castError`).
export type ErrorHandler = (error: Error) => void;

// VZN: cleanups are stored lazily (Solid v2 style): undefined → a single fn →
// an array. 0 or 1 cleanups (the common case) allocate no array.
type Cleanups = CleanupFn | CleanupFn[] | undefined;

// VZN: an owner holds imperative cleanups. Effects, scopes, and computeds are all
// owners. Scopes have no extra fields beyond the owner base.
interface OwnerNode extends ReactiveNode {
  cleanups: Cleanups;
  context: Record<symbol, unknown>; // VZN: context map, inherited from the parent owner
}

// VZN: an opaque handle to a reactive owner, for `getOwner` / `runWithOwner`.
export type Owner = OwnerNode;

interface EffectNode extends OwnerNode {
  fn(): void | (() => void); // VZN: may return a teardown fn (registered like onCleanup)
}

interface ComputedNode<T = unknown> extends OwnerNode {
  value: T | undefined;
  getter: (previousValue?: T) => T;
  // VZN: error status as node state — 0 = ok, 1 = errored. An errored memo remembers
  // its (normalized) error and rethrows it on read, so the error propagates and
  // coheres downstream like a value, instead of being re-derived by re-running the
  // getter on every read. `updateComputed` catches-and-stores rather than throwing,
  // so a throw never escapes into the engine's `checkDirty` traversal.
  status: number;
  error: Error | undefined;
}

interface SignalNode<T = unknown> extends ReactiveNode {
  currentValue: T;
  pendingValue: T;
}

let cycle = 0;
let runDepth = 0;
let batchDepth = 0;
let notifyIndex = 0;
let queuedLength = 0;
let flushScheduled = false; // VZN
let syncMode = false; // VZN: inside `flushSync(fn)`, writes flush per-write
let activeSub: ReactiveNode | undefined;
let activeOwner: OwnerNode | undefined; // VZN
let globalOwner: OwnerNode | undefined; // VZN: collects un-rooted work

// VZN: the shared empty base context map (Solid's `defaultContext`). Every owner's
// `context` starts here, so reads never need a null check; `setContext` spreads a
// fresh map and never mutates it.
const defaultContext: Record<symbol, unknown> = {};

// VZN: the private context key under which `onError` stores the active error
// handler. Storing it in the context map means it flows down the owner tree exactly
// like any context value — no parent pointers, no runtime walk.
const ERROR_HANDLER = Symbol("vzn-error-handler");

const queued: (EffectNode | undefined)[] = [];
const { link, unlink, propagate, checkDirty, shallowPropagate } = createReactiveSystem({
  // Alien: VERBATIM
  update(node: SignalNode | ComputedNode | OwnerNode): boolean {
    if ("getter" in node) {
      return updateComputed(node);
    }
    if ("currentValue" in node) {
      return updateSignal(node);
    }
    node.flags = 1;
    return true;
  },
  // Alien: VERBATIM except the loop — alien's `do { } while (true)` is written as
  // `for (;;)` (`while (true)` trips oxlint's no-constant-condition; identical logic).
  notify(effect: EffectNode) {
    let insertIndex = queuedLength;
    let firstInsertedIndex = insertIndex;

    for (;;) {
      queued[insertIndex++] = effect;
      effect.flags &= ~2;
      effect = effect.subs?.sub as EffectNode;
      if (effect === undefined || !(effect.flags & 2)) {
        break;
      }
    }

    queuedLength = insertIndex;

    while (firstInsertedIndex < --insertIndex) {
      const left = queued[firstInsertedIndex];
      queued[firstInsertedIndex++] = queued[insertIndex];
      queued[insertIndex] = left;
    }
  },
  unwatched(node: SignalNode | ComputedNode | EffectNode | OwnerNode) {
    if ("getter" in node) {
      if (node.depsTail !== undefined) {
        node.flags = 1 | 16;
        disposeAllDepsInReverse(node);
      }
      if (node.cleanups) runCleanups(node); // VZN: memo cleanups on dispose
    } else if ("currentValue" in node) {
      // Nothing to do for signals.
    } else {
      disposeOper.call(node as OwnerNode); // effect or scope
    }
  },
});

// Alien: VERBATIM
function setActiveSub(sub?: ReactiveNode): ReactiveNode | undefined {
  const prevSub = activeSub;
  activeSub = sub;
  return prevSub;
}

function setActiveOwner(owner?: OwnerNode): OwnerNode | undefined {
  const prevOwner = activeOwner;
  activeOwner = owner;
  return prevOwner;
}

// VZN: the owner a newly-created owner should attach to for cascade disposal —
// the active owner, or a lazily-created global owner disposed next macrotask.
function ownerFor(parent: OwnerNode | undefined): OwnerNode {
  if (parent !== undefined) return parent;
  if (globalOwner === undefined) {
    globalOwner = makeScope();
    setTimeout(disposeGlobalOwner, 0);
  }
  return globalOwner;
}

function disposeGlobalOwner(): void {
  const owner = globalOwner!;
  globalOwner = undefined;
  disposeOper.call(owner);
}

function makeScope(): OwnerNode {
  return {
    cleanups: undefined,
    context: activeOwner?.context ?? defaultContext, // VZN: inherit from the lexical parent
    deps: undefined,
    depsTail: undefined,
    subs: undefined,
    subsTail: undefined,
    flags: 1,
  };
}

// Alien: VERBATIM (kept internal — `batch` is the public entry point)
function startBatch(): void {
  ++batchDepth;
}

// Alien: VERBATIM (kept internal — `batch` is the public entry point)
function endBatch(): void {
  if (!--batchDepth) {
    flush();
  }
}

// VZN: synchronous flushing. (alien's internal drain is `flush`; this public name
// follows React.)
//   flushSync()    — drain pending scheduled effects now (no-op inside an open batch).
//   flushSync(fn)  — run `fn` with synchronous scheduling: each write inside flushes
//                    its effects immediately (per-write, not deferred-to-the-end),
//                    returning `fn`'s result. A scoped sync scheduler. Writes still
//                    defer inside an enclosing `batch`.
export function flushSync(): void;
export function flushSync<T>(fn: () => T): T;
export function flushSync<T>(fn?: () => T): T | void {
  if (fn !== undefined) {
    const prev = syncMode;
    syncMode = true;
    try {
      return fn();
    } finally {
      syncMode = prev;
    }
  }
  if (batchDepth) return;
  flushScheduled = false;
  flush();
}

/** Run `fn`, deferring effect flushes until it returns. */
export function batch<T>(fn: () => T): T {
  startBatch();
  try {
    return fn();
  } finally {
    endBatch();
  }
}

// VZN: schedule the queued effects. Inside `flushSync(fn)` (syncMode) they run now,
// per-write; otherwise they are coalesced onto the next microtask.
function scheduleFlush(): void {
  if (batchDepth) {
    return;
  }
  if (syncMode) {
    flush();
    return;
  }
  if (flushScheduled) {
    return;
  }
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    flush();
  });
}

// Alien: VERBATIM
export function signal<T>(): {
  (): T | undefined;
  (value: T | undefined): void;
};
export function signal<T>(initialValue: T): {
  (): T;
  (value: T): void;
};
export function signal<T>(initialValue?: T): {
  (): T | undefined;
  (value: T | undefined): void;
} {
  return signalOper.bind({
    currentValue: initialValue,
    pendingValue: initialValue,
    subs: undefined,
    subsTail: undefined,
    flags: 1,
  }) as () => T | undefined;
}

// Invalidate the signals read inside `fn` without changing their values, forcing
// their subscribers to recompute — e.g. after mutating an object held in a signal.
// The common form is `trigger(mySignal)`; `trigger(() => { a(); b(); })` invalidates
// several at once.
// Alien: VERBATIM except the final flush — VZN schedules it (async) via
// `scheduleFlush()` instead of alien's synchronous `flush()`.
export function trigger(fn: () => void): void {
  const sub: ReactiveNode = { deps: undefined, depsTail: undefined, flags: 2 };
  const prevSub = setActiveSub(sub);
  try {
    fn();
  } finally {
    activeSub = prevSub;
    sub.flags = 0;
    let link = sub.deps;
    while (link !== undefined) {
      const dep = link.dep;
      link = unlink(link, sub);
      const subs = dep.subs;
      if (subs !== undefined) {
        propagate(subs, !!runDepth);
        shallowPropagate(subs);
      }
    }
    if (!batchDepth) scheduleFlush();
  }
}

// A lazy, cached derivation. VZN: it is an owner — `onCleanup` inside it runs
// before each recompute and when the memo is disposed (loses all subscribers).
export function computed<T>(getter: (previousValue?: T) => T): () => T {
  return computedOper.bind({
    value: undefined,
    cleanups: undefined, // VZN
    context: activeOwner?.context ?? defaultContext, // VZN: inherit from the lexical parent
    status: 0, // VZN: ok until the getter throws
    error: undefined, // VZN
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: 0,
    getter: getter as (previousValue?: unknown) => unknown,
  }) as () => T;
}

// VZN: effects register cleanups imperatively via `onCleanup` and/or by returning
// a teardown fn (React/alien style). An effect runs once immediately. It is owned
// (a `root`, or the global owner) so it is torn down with its owner, AND it returns
// a disposer — calling it runs the effect's cleanups and removes it early.
export function effect(fn: () => void | (() => void)): () => void {
  const e: EffectNode = {
    fn,
    cleanups: undefined,
    context: activeOwner?.context ?? defaultContext, // VZN: inherit from the lexical parent
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: 2 | 4,
  };
  const prevSub = activeSub;
  const prevOwner = activeOwner;
  const owner = ownerFor(prevOwner); // VZN: attach for cascade disposal
  link(e, owner, 0);
  owner.flags |= 64;
  activeSub = e;
  activeOwner = e;
  try {
    ++runDepth;
    const cleanup = e.fn();
    if (cleanup) onCleanup(cleanup); // VZN: a returned teardown joins the cleanups
  } catch (error) {
    runCleanups(e); // VZN: release on throw
    handleError(error, e); // VZN: route to the nearest onError, else rethrow
  } finally {
    --runDepth;
    activeSub = prevSub;
    activeOwner = prevOwner;
    e.flags &= ~4;
  }
  return disposeOper.bind(e);
}

// VZN: a root owns a reactivity tree and returns its `dispose`. It escapes any
// enclosing owner (not linked), so it is not torn down when a parent re-runs.
// (alien's `effectScope`, but detached from the parent and with throw-cleanup.)
export function root(fn: () => void): () => void {
  const node = makeScope();
  const prevSub = activeSub;
  const prevOwner = activeOwner;
  activeSub = node;
  activeOwner = node;
  try {
    fn();
  } catch (error) {
    disposeOper.call(node); // VZN: release what was set up before the throw
    handleError(error, node); // VZN: route to the nearest onError, else rethrow
  } finally {
    activeSub = prevSub;
    activeOwner = prevOwner;
  }
  return disposeOper.bind(node);
}

// VZN: the current owner (effect, scope, or memo), or undefined at the top level.
// Useful for re-attaching async work or building patterns like `createSubRoot`.
export function getOwner(): Owner | undefined {
  return activeOwner;
}

// VZN: run `fn` with `owner` as the active owner (and tracking context), e.g. to
// register an `onCleanup` against a captured owner. Restores afterwards.
export function runWithOwner<T>(owner: Owner | undefined, fn: () => T): T {
  const prevSub = activeSub;
  const prevOwner = activeOwner;
  activeSub = owner;
  activeOwner = owner;
  try {
    return fn();
  } finally {
    activeSub = prevSub;
    activeOwner = prevOwner;
  }
}

// VZN: a typed context key. Solid's model — context flows down the owner tree by
// each owner inheriting its parent's map at creation (no runtime tree walk).
export interface Context<T> {
  readonly id: symbol;
  readonly defaultValue: T | undefined;
}

// VZN: create a context key with an optional default and debug description.
export function createContext<T>(defaultValue?: T, description?: string): Context<T> {
  return { id: Symbol(description), defaultValue };
}

// VZN: read a context value from `owner` (defaults to the active owner). Returns
// the default when no value was provided up the tree (or there is no owner).
export function getContext<T>(
  context: Context<T>,
  owner: Owner | undefined = activeOwner,
): T | undefined {
  const map = owner?.context ?? defaultContext;
  return context.id in map ? (map[context.id] as T) : context.defaultValue;
}

// VZN: provide a context value on `owner` (defaults to the active owner) for the
// owners created beneath it. A fresh map is used, so the parent is never mutated.
export function setContext<T>(
  context: Context<T>,
  value: T,
  owner: Owner | undefined = activeOwner,
): void {
  const o = ownerFor(owner);
  o.context = { ...o.context, [context.id]: value };
}

/**
 * VZN: schedule a task to run before the current owner (effect, scope, or memo)
 * recomputes or is disposed. Outside a root it attaches to the global owner,
 * which is disposed on the next macrotask.
 */
export function onCleanup(disposable: CleanupFn): void {
  const owner = ownerFor(activeOwner);
  const existing = owner.cleanups;
  if (existing === undefined) {
    owner.cleanups = disposable; // first: store the fn directly, no array
  } else if (typeof existing === "function") {
    owner.cleanups = [existing, disposable]; // second: promote to an array
  } else {
    existing.push(disposable);
  }
}

// VZN: register an error handler on the current owner — the internal primitive
// behind `catchError`. Stores the handler in the owner's context map so it flows down
// to descendants like any context value; nested handlers override, and a handler that
// itself throws bubbles to the next one up (the previous value, captured here).
function onError(handler: ErrorHandler): void {
  const owner = ownerFor(activeOwner);
  const parent = owner.context[ERROR_HANDLER] as ErrorHandler | undefined;
  owner.context = {
    ...owner.context,
    [ERROR_HANDLER]:
      parent === undefined
        ? handler
        : (error: Error) => {
            try {
              handler(error);
            } catch (rethrown) {
              // VZN: a throwing handler bubbles (normalized) to the outer boundary —
              // Solid PR #1774, "Propagate errors to parents in nested catchError".
              parent(castError(rethrown));
            }
          },
  };
}

// VZN: run `fn` inside a child owner guarded by `handler` (Solid's `catchError`). A
// throw from `fn` — synchronously, or later from an effect/memo created within it —
// is routed to `handler` instead of propagating, and `fn`'s result is returned (or
// `undefined` when it threw). Nesting scopes error handling to a subtree; a handler
// that itself throws bubbles to the next `catchError`/`onError` out. Built on
// `onError`, so it shares one routing path.
export function catchError<T>(fn: () => T, handler: ErrorHandler): T | undefined {
  const node = makeScope();
  const owner = ownerFor(activeOwner);
  link(node, owner, 0); // VZN: owned by the parent — torn down with it
  owner.flags |= 64;
  const prevSub = activeSub;
  const prevOwner = activeOwner;
  activeSub = node;
  activeOwner = node;
  try {
    onError(handler);
    return fn();
  } catch (error) {
    disposeOper.call(node); // VZN: release what `fn` set up before the throw
    handleError(error, node);
  } finally {
    activeSub = prevSub;
    activeOwner = prevOwner;
  }
  return undefined;
}

// VZN: run `fn` without tracking reactive reads against the current computation.
// Cleanups registered inside still belong to the current owner.
export function untrack<T>(fn: () => T): T {
  const prevSub = setActiveSub(undefined);
  try {
    return fn();
  } finally {
    setActiveSub(prevSub);
  }
}

function updateComputed(c: ComputedNode): boolean {
  if (c.flags & 64) {
    let link = c.depsTail;
    while (link !== undefined) {
      const prev = link.prevDep;
      const dep = link.dep;
      if (!("getter" in dep) && !("currentValue" in dep)) {
        unlink(link, c);
      }
      link = prev;
    }
  }
  if (c.cleanups) runCleanups(c); // VZN: run the memo's cleanups before recompute
  c.depsTail = undefined;
  c.flags = 1 | 4;
  const prevSub = activeSub;
  const prevOwner = activeOwner; // VZN
  activeSub = c;
  activeOwner = c;
  const wasErrored = c.status !== 0; // VZN: recovering from an error is itself a change
  try {
    ++cycle;
    const oldValue = c.value;
    c.status = 0; // VZN: assume success — the catch flips it back
    return (c.value = c.getter(oldValue)) !== oldValue || wasErrored;
  } catch (error) {
    runCleanups(c); // VZN
    c.status = 1; // VZN: remember the error; reads rethrow it (don't throw into the engine)
    c.error = castError(error);
    return true; // VZN: an errored memo counts as changed, so dependents refresh
  } finally {
    activeSub = prevSub;
    activeOwner = prevOwner; // VZN
    c.flags &= ~4;
    purgeDeps(c);
  }
}

// Alien: VERBATIM
function updateSignal(s: SignalNode): boolean {
  s.flags = 1;
  return s.currentValue !== (s.currentValue = s.pendingValue);
}

function run(e: EffectNode): void {
  const flags = e.flags;
  if (flags & 16 || (flags & 32 && checkDirty(e.deps!, e))) {
    if (flags & 64) {
      let link = e.depsTail;
      while (link !== undefined) {
        const prev = link.prevDep;
        const dep = link.dep;
        if (!("getter" in dep) && !("currentValue" in dep)) {
          unlink(link, e);
        }
        link = prev;
      }
    }
    if (e.cleanups) {
      runCleanups(e);
      if (!e.flags) {
        return;
      }
    }
    e.depsTail = undefined;
    e.flags = 2 | 4;
    const prevSub = activeSub;
    const prevOwner = activeOwner; // VZN
    activeSub = e;
    activeOwner = e;
    try {
      ++cycle;
      ++runDepth;
      const cleanup = e.fn();
      if (cleanup) onCleanup(cleanup); // VZN: a returned teardown joins the cleanups
    } catch (error) {
      runCleanups(e); // VZN: release on throw
      handleError(error, e); // VZN: route to the nearest onError, else rethrow
    } finally {
      --runDepth;
      activeSub = prevSub;
      activeOwner = prevOwner; // VZN
      e.flags &= ~4;
      purgeDeps(e);
    }
  } else if (e.deps !== undefined) {
    e.flags = 2 | (flags & 64);
  }
}

// Alien: VERBATIM
function flush(): void {
  try {
    while (notifyIndex < queuedLength) {
      const effect = queued[notifyIndex]!;
      queued[notifyIndex++] = undefined;
      run(effect);
    }
  } finally {
    while (notifyIndex < queuedLength) {
      const effect = queued[notifyIndex]!;
      queued[notifyIndex++] = undefined;
      effect.flags |= 2 | 8;
    }
    notifyIndex = 0;
    queuedLength = 0;
  }
}

function computedOper(this: ComputedNode): unknown {
  const flags = this.flags;
  if (
    flags & 16 ||
    (flags & 32 && (checkDirty(this.deps!, this) || ((this.flags = flags & ~32), false)))
  ) {
    if (updateComputed(this)) {
      const subs = this.subs;
      if (subs !== undefined) {
        shallowPropagate(subs);
      }
    }
  } else if (!flags) {
    this.flags = 1 | 4;
    const prevSub = setActiveSub(this);
    const prevOwner = setActiveOwner(this); // VZN
    try {
      this.status = 0; // VZN
      this.value = this.getter();
    } catch (error) {
      runCleanups(this); // VZN
      this.status = 1; // VZN: remember the error; reads rethrow it
      this.error = castError(error);
    } finally {
      activeSub = prevSub;
      activeOwner = prevOwner; // VZN
      this.flags &= ~4;
    }
  }
  const sub = activeSub;
  if (sub !== undefined) {
    link(this, sub, cycle); // VZN: subscribe BEFORE rethrowing, so the reader re-runs once the error clears
  }
  if (this.status !== 0) {
    throw this.error; // VZN: surface the remembered error to the reader
  }
  return this.value!;
}

function signalOper(this: SignalNode, ...value: [unknown?]): unknown {
  if (value.length) {
    if (this.pendingValue !== (this.pendingValue = value[0])) {
      this.flags = 1 | 16;
      const subs = this.subs;
      if (subs !== undefined) {
        propagate(subs, !!runDepth);
        if (!batchDepth) {
          scheduleFlush(); // VZN: async instead of a synchronous flush
        }
      }
    }
  } else {
    if (this.flags & 16) {
      if (updateSignal(this)) {
        const subs = this.subs;
        if (subs !== undefined) {
          shallowPropagate(subs);
        }
      }
    }
    const sub = activeSub;
    if (sub !== undefined) {
      link(this, sub, cycle);
    }
    return this.currentValue;
  }
}

// VZN: normalize a thrown value into an `Error`, preserving the original as `cause`,
// so handlers can always rely on `.message`/`.stack`. (Ported from Solid PR #1530 —
// "Cast string into error while handling errors".)
function castError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : "Unknown error", { cause: error });
}

// VZN: route an error thrown by `owner`'s computation to the nearest `onError`
// handler carried in its (inherited) context map; rethrow when none is registered.
// The error is normalized to an `Error` first. The handler runs untracked and
// un-owned, so its writes don't subscribe the failed computation and its cleanups
// don't attach to it.
function handleError(error: unknown, owner: OwnerNode): void {
  const handler = owner.context[ERROR_HANDLER] as ErrorHandler | undefined;
  const casted = castError(error);
  if (handler === undefined) {
    throw casted;
  }
  const prevSub = activeSub;
  const prevOwner = activeOwner;
  activeSub = undefined;
  activeOwner = undefined;
  try {
    handler(casted);
  } finally {
    activeSub = prevSub;
    activeOwner = prevOwner;
  }
}

// VZN: run an owner's imperative cleanups (LIFO), untracked.
function runCleanups(e: OwnerNode): void {
  const cleanups = e.cleanups;
  if (cleanups === undefined) {
    return;
  }
  e.cleanups = undefined;
  const prevSub = activeSub;
  const prevOwner = activeOwner;
  activeSub = undefined;
  activeOwner = undefined;
  try {
    if (typeof cleanups === "function") {
      cleanups();
    } else {
      for (let index = cleanups.length - 1; index >= 0; index--) cleanups[index]();
    }
  } finally {
    activeSub = prevSub;
    activeOwner = prevOwner;
  }
}

// VZN: dispose an owner (effect or scope) — tear down its child reactions, unlink
// it from observers, then run its onCleanup callbacks.
function disposeOper(this: OwnerNode): void {
  this.flags = 0;
  disposeAllDepsInReverse(this);
  const sub = this.subs;
  if (sub !== undefined) {
    unlink(sub);
  }
  if (this.cleanups) {
    runCleanups(this);
  }
}

// Alien: VERBATIM
function disposeAllDepsInReverse(sub: ReactiveNode): void {
  let link = sub.depsTail;
  while (link !== undefined) {
    const prev = link.prevDep;
    unlink(link, sub);
    link = prev;
  }
}

// Alien: VERBATIM
function purgeDeps(sub: ReactiveNode): void {
  const depsTail = sub.depsTail;
  let dep = depsTail !== undefined ? depsTail.nextDep : sub.deps;
  while (dep !== undefined) {
    dep = unlink(dep, sub);
  }
}
