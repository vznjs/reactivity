# Architecture

VZN is a single file: [`src/index.ts`](../src/index.ts). It runs its own instance of **alien-signals'** `createReactiveSystem` engine and adds a thin ownership/scheduling layer on top. This document explains how that layer works and exactly where VZN departs from alien.

## The design in one paragraph

alien-signals gives us a fast, glitch-free push-pull dependency graph but is **synchronous** and has **no ownership model**. VZN keeps alien's graph and operators almost verbatim, and changes only two things:

1. **The write path is async.** Instead of flushing effects synchronously on every write, VZN schedules a microtask (`scheduleFlush`) so synchronous writes coalesce.
2. **A cleanup _owner_ is tracked alongside the tracking _subscriber_.** This one decoupling is what gives VZN `root` scopes, `onCleanup` (in effects _and_ memos), cleanup-on-throw, `untrack`-safe cleanup, and auto-disposal of un-rooted work.

Everything else — `link`/`unlink`/`propagate`/`checkDirty`, the flag transitions, the diamond/glitch handling — is alien's, unchanged.

## The engine

```ts
const { link, unlink, propagate, checkDirty, shallowPropagate } = createReactiveSystem({
  update,
  notify,
  unwatched,
});
```

`createReactiveSystem` is alien's intrusive doubly-linked graph. Nodes are connected by `Link` records; the caller supplies three callbacks:

- **`update(node)`** — recompute a node, return whether its value changed. VZN dispatches on node shape (`"getter" in node` → computed, `"currentValue" in node` → signal). _Alien-verbatim._
- **`notify(effect)`** — queue an effect (and its watching ancestors) to run. _Alien-verbatim._
- **`unwatched(node)`** — a node lost its last subscriber. VZN extends this to run a memo's cleanups and to dispose owners.

VZN runs **its own** instance of this engine. That is the key reason VZN can't just import alien's `signal`/`effect`: alien's operators are bound to alien's _own_ engine instance and its module-level `activeSub`/queue. A VZN signal must link into VZN's graph.

## Node flags

alien encodes node state in a bitfield. VZN hardcodes the literals (the toolchain forbids `const enum`) with a legend at the top of the file:

| Bit | Name             | Meaning                                                           |
| --- | ---------------- | ----------------------------------------------------------------- |
| 0   | `None`           | no state                                                          |
| 1   | `Mutable`        | can produce/recompute a value (signals, computeds)                |
| 2   | `Watching`       | an effect/watcher — gets queued & notified                        |
| 4   | `RecursedCheck`  | currently running its tracking window (re-entrancy guard)         |
| 8   | `Recursed`       | reached again while pending — needs a re-check                    |
| 16  | `Dirty`          | known stale — must recompute                                      |
| 32  | `Pending`        | maybe stale (a transitive dep changed) — confirm via `checkDirty` |
| 64  | `HasChildEffect` | owns at least one child effect (gates the dispose-children path)  |

## Node types

```
ReactiveNode (alien)
├─ SignalNode      { currentValue, pendingValue }
└─ OwnerNode       { cleanups }              ← VZN: owns imperative cleanups
   ├─ EffectNode   { fn }
   └─ ComputedNode { value, getter }
```

The VZN addition is `OwnerNode` — anything that can hold `onCleanup` callbacks. **Effects, computeds, and roots are all owners.** Cleanups are stored lazily (Solid v2 style): `undefined → fn → fn[]`, so the common 0-or-1-cleanup case allocates no array.

## The two cursors: `activeSub` vs `activeOwner`

This is the heart of VZN.

- **`activeSub`** — the node that reactive _reads_ subscribe to. Set during tracking, cleared by `untrack`.
- **`activeOwner`** — the node that `onCleanup` _attaches_ to. Set whenever an owner runs.

alien has only `activeSub` (it uses it for both tracking and parent-linking). By splitting them, VZN gets:

- **`onCleanup` survives `untrack`** — `untrack` clears `activeSub` but leaves `activeOwner`, so a cleanup registered inside still belongs to the surrounding owner.
- **`onCleanup` inside a memo** — a computed sets `activeOwner = self` while evaluating, so cleanups attach to the memo and run on recompute / unwatch.
- **Cleanup that outlives tracking** — async callbacks can `runWithOwner(owner, …)` to register against a captured owner.

During a normal effect/computed run, `activeSub === activeOwner === self`. They only diverge inside `untrack`.

## Ownership & disposal

Every effect/computed/root is linked to a **parent owner** when created (`ownerFor(activeOwner)`), and the parent gets the `HasChildEffect` flag. Disposal cascades:

```
disposeOper(owner):
  flags = 0
  disposeAllDepsInReverse(owner)   // tear down children (LIFO, depth-first)
  unlink(owner.subs)               // detach from anyone watching it
  runCleanups(owner)               // run onCleanup callbacks (LIFO), untrack
```

`runCleanups` nulls the cleanup storage after running, which makes `dispose` **idempotent** for free — no guard flag needed.

### `root`

```ts
export function root(fn: () => void): () => void;
```

Sets itself as `activeSub`/`activeOwner`, runs `fn`, and returns `disposeOper.bind(node)`. Two traits distinguish it from alien's `effectScope`:

- **Detached** — it does _not_ link to the enclosing owner, so a nested root survives its parent re-running.
- **Throw-safe** — if `fn` throws during setup, the partial tree is disposed before re-throwing.

### Un-rooted auto-dispose

Reactivity created with no active owner attaches to a lazily-created `globalOwner`, which is scheduled for disposal on the next macrotask (`setTimeout(…, 0)`). So top-level reactivity reacts across microtasks but is cleaned up automatically — you never leak by forgetting a `root`, and you never have a dangling effect living forever.

## Scheduling

VZN is **async by default**. The write path (`signalOper` / `trigger`) calls `scheduleFlush` instead of alien's synchronous `flush`:

```ts
function scheduleFlush() {
  if (batchDepth) return; // a batch defers everything
  if (syncMode) {
    flush();
    return;
  } // inside flushSync(fn): flush per-write
  if (flushScheduled) return; // coalesce
  flushScheduled = true;
  queueMicrotask(() => {
    flushScheduled = false;
    flush();
  });
}
```

`flush` itself is alien-verbatim — it drains the queued effects (cascading writes append to the live queue and drain in the same pass).

The synchronous escapes:

| Primitive       | Behavior                                                                                                              |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| `batch(fn)`     | Defer effects until the batch closes, then flush once. (Wraps internal `startBatch`/`endBatch`.)                      |
| `flushSync()`   | Drain pending effects now (no-op inside an open batch).                                                               |
| `flushSync(fn)` | Run `fn` with `syncMode` on: each write flushes **per-write**. A scoped synchronous scheduler. Returns `fn`'s result. |

Precedence: `batch` always wins (defers regardless of `syncMode`); `flushSync()` forces a drain now; `syncMode` makes individual writes synchronous.

## Operator map: what's alien, what's VZN

The source marks every fully-identical function `// Alien: VERBATIM` and every change `// VZN:`.

**Verbatim from alien** (only flag literals / formatting differ): `update`, `notify`, `setActiveSub`, `startBatch`, `endBatch`, `signal`, `updateSignal`, `flush`, `disposeAllDepsInReverse`, `purgeDeps`. (`notify` differs only in spelling `do/while(true)` as `for(;;)` to satisfy the linter; `trigger` is verbatim except its final flush is async.)

**alien body + a small marked VZN delta**: `computed` (adds the `cleanups` field), `signalOper` (`flush` → `scheduleFlush`), `run` & `computedOper` (add `activeOwner` save/restore + cleanup-on-throw; `run` also registers a returned teardown via `onCleanup`). (`trigger` is counted as verbatim above — its only change is the same async flush.)

**VZN rewrites of an alien function**: `effect` (owned, async, imperative + return cleanup), `updateComputed` & `unwatched` (memo cleanups), `runCleanups` (lazy storage), `disposeOper` (merges alien's `effectOper` + `effectScopeOper`).

**VZN-only**: `root`, `onCleanup`, `untrack`, `flushSync`, `batch`, `scheduleFlush`, `getOwner`, `runWithOwner`, `ownerFor`, `makeScope`, the `globalOwner` machinery.

**Dropped from alien**: `effectScope` (replaced by `root`), `getActiveSub`, `getBatchDepth`, the `isSignal`/`isComputed`/`isEffect`/`isEffectScope` brand checks.

## Correctness

VZN is verified two ways:

- **Conformance** — it passes the cross-framework `reactive-framework-test-suite` (179 cases covering graph propagation, dynamic deps, diamonds, glitch-freedom, effect lifecycle, error handling, GC). The adapter runs each case inside `flushSync(fn)` so VZN's async writes settle synchronously to match the suite's sync assumptions; pure `s(v)` writes need no per-call flushing.
- **Own suite** — 130+ tests covering signals, computeds, effects, roots, cleanup ordering (LIFO/depth-first), scheduling, `untrack`, `trigger`, and ports of alien's own `effect.spec` / `effectScope.spec` / `trigger.spec`. (Over 300 tests in total, conformance included.)
