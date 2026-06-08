# Comparison: VZN vs alien-signals vs Solid

Companion to [`ARCHITECTURE.md`](./ARCHITECTURE.md). Where VZN sits relative to the two systems closest to it — **alien-signals** (whose engine it uses) and **Solid v2** (`@solidjs/signals`, source-verified at `0.13.13`) — plus notes on React and Vue where the scheduling model is instructive.

## At a glance

|                             |             **VZN**             |        alien-signals         |   Solid signals (v2)   |
| --------------------------- | :-----------------------------: | :--------------------------: | :--------------------: |
| Core graph                  |  alien `createReactiveSystem`   |         alien (own)          |     own push-pull      |
| Default scheduling          |      **async** (microtask)      |           **sync**           | **async** (microtask)  |
| Ownership & auto-dispose    | ✅ `root` + global auto-dispose |              ❌              |           ✅           |
| Effect signature            |  `() => void \| (() => void)`   | `() => void \| (() => void)` |      `() => void`      |
| Imperative `onCleanup`      |               ✅                |       ❌ (return only)       |           ✅           |
| Return-teardown             |               ✅                |              ✅              | ❌ (cleanup via owner) |
| `onCleanup` inside a memo   |               ✅                |              ❌              |           ✅           |
| Cleanups run if body throws |               ✅                |              ❌              |           ✅           |
| Force-invalidate            |          ✅ `trigger`           |         ✅ `trigger`         |           ❌           |
| Synchronous flush           |          `flushSync()`          |        (always sync)         |       `flush()`        |
| Scoped sync scheduler       |       ✅ `flushSync(fn)`        |             n/a              |           ❌           |
| `batch`                     |               ✅                |   `startBatch`/`endBatch`    |  ❌ (async coalesces)  |
| Effect ordering lanes       |               ❌                |              ❌              | ✅ render/user/tracked |
| Runtime deps                |          alien-signals          |             none             |          none          |

## VZN vs alien-signals

VZN **is** alien at the engine level — same `createReactiveSystem`, same propagation, same flags. The differences are all in the layer on top.

### Scheduling

alien is synchronous: a write flushes its effects immediately. VZN is async-by-default: a write schedules a microtask, so synchronous writes coalesce automatically. VZN re-implements only the write path (`scheduleFlush` instead of `flush`) and adds `batch` / `flushSync` / `flushSync(fn)` as escapes. alien needs `startBatch`/`endBatch` to coalesce (because it's sync); VZN coalesces for free and uses batching only when you want synchronous settling.

### Ownership

alien has **no ownership model**. You dispose an effect by calling the disposer it returns; an `effectScope` groups effects but you still hold and call its disposer. There is no automatic teardown — forget a disposer and it leaks.

VZN adds Solid-style ownership: `root` scopes that cascade-dispose, `onCleanup` for imperative teardown, and a global owner that auto-disposes un-rooted work on the next macrotask. alien's `effectScope` becomes VZN's `root` (detached from its parent and throw-safe).

### Cleanup

alien cleanup is **return-based only**: an effect returns a teardown function, stored in a single `cleanup` slot. Computeds have no cleanup.

VZN supports **both** styles — return a teardown _and/or_ call `onCleanup` (any number of times, even nested or inside `untracked`) — and extends cleanup to **computeds** (run on recompute and when the memo is unwatched) and to the **throw path** (cleanups registered before a throw still run).

### What VZN drops

alien's `getActiveSub`, `getBatchDepth`, and the `isSignal`/`isComputed`/`isEffect`/`isEffectScope` brand-check helpers are not exposed. `effectScope` is replaced by `root`. `setActiveSub` is kept internal.

### API mapping

| alien                         | VZN                                     |
| ----------------------------- | --------------------------------------- |
| `signal(v)`                   | `signal(v)` (identical)                 |
| `computed(fn)`                | `computed(fn)` (+ supports `onCleanup`) |
| `effect(fn)`                  | `effect(fn)` (owned; `+ onCleanup`)     |
| `effectScope(fn)`             | `root(fn)` (detached, throw-safe)       |
| `trigger(fn)`                 | `trigger(fn)` (async flush)             |
| `startBatch`/`endBatch`       | internal — use `batch(fn)`              |
| (always sync)                 | `flushSync()` / `flushSync(fn)`         |
| `getActiveSub`/`setActiveSub` | `getOwner`/`runWithOwner` (owner-based) |

## VZN vs Solid signals (v2)

Solid's `@solidjs/signals` and VZN land in a very similar place — **async-by-default with an ownership model** — which is unsurprising, since both take the "Solid-style ownership over a fast graph" approach. The scheduling cores are nearly identical: both schedule a microtask on write and coalesce, both guard against re-entrancy, both expose a synchronous drain (Solid calls it `flush`, VZN calls it `flushSync`).

Where they differ:

- **Cleanup style.** Solid effects are `() => void` and rely on `onCleanup` + ownership; they don't use return-based teardown. VZN supports `onCleanup` _and_ return-teardown (the latter for React/alien familiarity).
- **Ordering vs sync-ness.** Solid's lever for control is **effect lanes** — `createRenderEffect` (render lane) runs before `createEffect` (user lane) within the same flush. That's _ordering_ control. VZN has a single effect type and instead offers _sync-ness_ control via `flushSync(fn)` (a scoped synchronous scheduler) and `batch`. Neither Solid nor alien has a per-region sync scheduler.
- **`trigger`.** VZN (via alien) can force-invalidate the subscribers of signals read in a function without changing any value — handy for in-place mutation. Solid has no direct equivalent.
- **`batch`.** Solid omits an explicit `batch` (async coalescing makes it largely redundant). VZN keeps `batch` because it provides _synchronous settling at the boundary_, a different guarantee from mere coalescing.

If you know Solid, VZN will feel familiar: `root` ≈ `createRoot`, `signal` ≈ `createSignal` (single-callable instead of a tuple), `computed` ≈ `createMemo`, `effect` ≈ `createEffect`, `onCleanup`/`untracked` are the same names.

## Scheduling models, side by side

| Library  | Write → effect    | Force sync                     | Coalesce region         | Granular control                 |
| -------- | ----------------- | ------------------------------ | ----------------------- | -------------------------------- |
| **VZN**  | async (microtask) | `flushSync()`                  | `batch`                 | `flushSync(fn)` (per-write sync) |
| alien    | **sync**          | (always)                       | `startBatch`/`endBatch` | —                                |
| Solid v2 | async (microtask) | `flush()`                      | —                       | render/user/tracked lanes        |
| React    | async (batched)   | `flushSync(fn)` (flush-at-end) | automatic               | transitions                      |
| Vue      | async (pre/post)  | `flush: 'sync'` watcher        | automatic               | per-watcher `flush`              |

> Note: VZN's `flushSync(fn)` borrows React's _name_ but not its exact semantics. React's `flushSync(fn)` defers writes inside `fn` and flushes once at the end (≈ VZN's `batch`); VZN's `flushSync(fn)` flushes **per-write** (a scoped sync scheduler, the behavior usually called `runInSync`). VZN's no-arg `flushSync()` matches the React/Solid "drain now" meaning.

## When to pick what

- **You want maximum speed and don't need ownership or async batching** → use **alien-signals** directly.
- **You want Solid's full framework** (JSX, stores, resources, transitions) → use **Solid**.
- **You want alien's engine with Solid-style ownership, automatic batching, flexible cleanup, and a tiny single-file footprint** → **VZN**.
