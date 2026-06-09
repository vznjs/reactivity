<p align="center">
  <img src="https://raw.githubusercontent.com/vznjs/reactivity/master/logo.png" alt="VZN Reactivity logo" />
</p>

# VZN | Reactivity

**The fastest reactive core, with an ownership model that doesn't leak.**

VZN is a fine-grained reactivity library built on top of [alien-signals](https://github.com/stackblitz/alien-signals)' `createReactiveSystem` engine — the same battle-tested push-pull graph that powers one of the fastest signal implementations in the wild — wrapped in the ergonomics of Solid-style ownership and React-style cleanup, with automatic async batching.

You get three best-in-class ideas in one tiny package:

- ⚡ **alien-signals' engine** — glitch-free push-pull propagation, minimal allocations, proven speed. Most of VZN's core is _alien-verbatim_.
- 🌳 **Solid-style ownership** — `root` scopes, cascading disposal, `onCleanup` that even works inside memos, and un-rooted reactivity that auto-disposes so you never leak by accident.
- ⏱️ **Async-by-default scheduling** — writes coalesce onto a microtask automatically, with surgical synchronous escapes when you need them.

It passes the cross-framework [reactive-framework-test-suite](https://www.npmjs.com/package/reactive-framework-test-suite) (179 conformance cases) — over 350 tests in total, including its own suite.

## Why VZN?

|                                      |           **VZN**            |    alien-signals    | Solid signals (v2) |
| ------------------------------------ | :--------------------------: | :-----------------: | :----------------: |
| Core graph                           | alien `createReactiveSystem` |     alien (own)     |   own push-pull    |
| Default scheduling                   |    **async** (microtask)     |        sync         | async (microtask)  |
| Ownership & auto-dispose             |   ✅ `root` + auto-dispose   | ❌ manual disposers |         ✅         |
| `onCleanup` (imperative)             |              ✅              |  ❌ (return only)   |         ✅         |
| Return-teardown (React style)        |              ✅              |         ✅          |         ✅         |
| `onCleanup` inside a memo            |              ✅              |         ❌          |         ✅         |
| Cleanups run if the body throws      |              ✅              |         ❌          |         ✅         |
| Error boundaries                     |       ✅ `catchError`        |         ❌          |         ✅         |
| Force-invalidate without a new value |         ✅ `trigger`         |    ✅ `trigger`     |         ❌         |
| Scoped synchronous scheduler         |      ✅ `flushSync(fn)`      |     n/a (sync)      |         ❌         |
| Runtime dependencies                 |        alien-signals         |        none         |        none        |

The pitch in one line: **alien's raw speed, Solid's ownership, React's cleanup flexibility, and automatic batching — in a single file.**

## Installation

```sh
npm install @vzn/reactivity
```

Requires a modern runtime (ES2020+). Ships as ESM with full TypeScript types.

## Quick start

```ts
import { root, signal, computed, effect, onCleanup } from "@vzn/reactivity";

const dispose = root(() => {
  const name = signal("VZN");
  const greeting = computed(() => `Hey ${name()}!`);

  effect(() => {
    console.log(greeting());
    onCleanup(() => console.log("cleaning up before the next run / on dispose"));
  });
  // → logs "Hey VZN!"

  name("Maciej");
  // on the next microtask → logs "Hey Maciej!"
});

// later: tear the whole tree down
dispose();
```

The golden rule: **wrap your app in a `root`.** Reactivity created outside a root still works, but is one-shot — it auto-disposes on the next macrotask so nothing leaks.

## Core concepts

### `signal` — a reactive value

A signal is a single callable: call it with no arguments to **read** (and track), call it with a value to **write**.

```ts
import { signal } from "@vzn/reactivity";

const name = signal("VZN");

name(); // "VZN"  (reads + subscribes the current computation)
name("Maciej"); // writes
name(); // "Maciej"
```

A signal only notifies subscribers when the value actually changes (`!==`). Writing the same value is a no-op. To force an update after mutating something in place, use [`trigger`](#trigger).

### `computed` — a lazy, cached derivation

A computed (memo) only evaluates when read, caches its result, and recomputes only when one of its dependencies changes. The getter receives its previous value.

```ts
import { signal, computed } from "@vzn/reactivity";

const count = signal(1);
const doubled = computed(() => count() * 2);

doubled(); // 2  (computed on first read, then cached)
count(2);
doubled(); // 4  (recomputed lazily on read)
```

Computeds are **owners**: you can register `onCleanup` inside them, and it runs before each recompute and when the memo loses its last subscriber.

### `effect` — a side effect that re-runs

An effect runs immediately, tracks what it reads, and re-runs when those dependencies change. It returns a **disposer**, and you can register teardown two ways — pick whichever you like:

```ts
import { signal, effect, onCleanup } from "@vzn/reactivity";

const query = signal("cats");

// imperative onCleanup (Solid style) — register as many as you like, even nested
const stop = effect(() => {
  const controller = new AbortController();
  fetch(`/search?q=${query()}`, { signal: controller.signal });
  onCleanup(() => controller.abort());
});

// or return a teardown (React/alien style)
effect(() => {
  const id = setInterval(tick, 1000);
  return () => clearInterval(id);
});

stop(); // dispose this effect early (runs its cleanups)
```

### `root` — an ownership scope

`root` owns a reactivity tree and **returns its disposer**. Disposing a root tears down every effect, computed, and cleanup created beneath it. Roots are detached: a nested root survives its parent re-running.

```ts
import { root, signal, effect } from "@vzn/reactivity";

const dispose = root(() => {
  const s = signal(0);
  effect(() => console.log(s()));
});

dispose(); // stops everything inside; idempotent
```

> Created reactivity outside any `root` attaches to a global owner that is disposed on the next macrotask — so top-level reactivity is one-shot unless you root it.

### `onCleanup` — schedule teardown

Registers a function to run before the current owner (effect, root, or memo) re-runs or is disposed. Cleanups run **LIFO**, and crucially they still run if the body throws.

```ts
effect(() => {
  const el = mount();
  onCleanup(() => unmount(el));
});
```

## Scheduling

VZN is **async by default**: writing a signal schedules its effects onto the next microtask, so a burst of synchronous writes coalesces into a single re-run automatically.

```ts
const s = signal(0);
effect(() => console.log(s()));

s(1);
s(2);
s(3);
// effect runs once, with the latest value, on the next microtask
```

When you need synchronous behavior, reach for one of the escapes:

### `batch`

Defer effects until the batch closes, then flush once.

```ts
import { batch } from "@vzn/reactivity";

batch(() => {
  firstName("Ada");
  lastName("Lovelace");
}); // effects depending on either run once, here, synchronously
```

### `flushSync` — synchronous flushing

```ts
import { flushSync } from "@vzn/reactivity";

flushSync(); // drain any pending effects right now

flushSync(() => {
  // run fn with SYNCHRONOUS scheduling:
  s(1); //   every write inside settles its effects immediately
  s(2); //   (per-write — not deferred to the end)
}); // returns fn's result
```

`flushSync(fn)` is a _scoped synchronous scheduler_: inside it, each write flushes per-write. (Writes still defer if you're inside an enclosing `batch`.) The no-arg `flushSync()` matches React/Solid's "drain now"; the callback form borrows React's name but flushes per-write rather than once at the end — see [`docs/COMPARISON.md`](docs/COMPARISON.md).

### `trigger` — invalidate without a new value

Force the subscribers of the signals read inside `fn` to recompute — useful after mutating an object or array in place.

```ts
import { signal, trigger } from "@vzn/reactivity";

const list = signal<number[]>([]);

list().push(1); // mutate in place — the signal's value (the array ref) didn't change
trigger(list); // ...so tell its subscribers to refresh anyway
```

## Utilities

### `untrack`

Read reactive values without subscribing the current computation to them.

```ts
import { untrack } from "@vzn/reactivity";

effect(() => {
  const live = tracked(); // a dependency
  const snapshot = untrack(() => other()); // read without tracking
});
```

`onCleanup` registered inside `untrack` still belongs to the current owner.

### `getOwner` / `runWithOwner`

Capture the current owner and run code against it later — for re-attaching async work, or building patterns like sub-roots on top of the public API.

```ts
import { getOwner, runWithOwner, onCleanup } from "@vzn/reactivity";

const owner = getOwner();
queueMicrotask(() => {
  runWithOwner(owner, () => onCleanup(() => console.log("tied to the captured owner")));
});
```

### `createContext` / `getContext` / `setContext`

Pass values down the owner tree without threading them through every call — Solid's context model (inherit-at-creation, no runtime tree walk). `setContext` provides a value for everything created beneath the current owner; `getContext` reads the nearest provided value, or the default.

```ts
import { createContext, getContext, setContext, root, effect } from "@vzn/reactivity";

const Theme = createContext("light");

root(() => {
  setContext(Theme, "dark");

  effect(() => {
    console.log(getContext(Theme)); // "dark" — inherited from the root
  });
});

effect(() => console.log(getContext(Theme))); // "light" — falls back to the default
```

A nested `root` (or any owner) can `setContext` again to override for its own subtree without affecting the parent. Both `getContext` and `setContext` take an optional owner argument, so they compose with `getOwner` / `runWithOwner` for async re-attach.

## Error handling

### `catchError` — an error boundary

`catchError(fn, handler)` runs `fn` inside an error boundary. A throw from `fn` — synchronously, or **later from an effect or memo created inside it** — is delivered to `handler` instead of propagating; the failing computation's cleanups have already run. The handler always receives a normalized `Error` (a thrown string/value is wrapped, with the original kept as `.cause`).

```ts
import { root, signal, effect, catchError } from "@vzn/reactivity";

root(() => {
  const user = signal<string | null>(null);

  catchError(
    () => {
      effect(() => {
        if (!user()) throw new Error("not logged in");
        render(user());
      });
    },
    (error) => showFallback(error.message), // runs now, and on every later re-throw
  );
});
```

`catchError` returns `fn`'s value (or `undefined` if it threw), and boundaries **nest**: a handler that itself throws bubbles to the next boundary out.

Errors in a **`computed`** are remembered as node state: a memo whose getter throws stores its error and rethrows it on read (the getter runs **once**, not on every read), so the error propagates and **coheres** through the derived graph — a memo reading an errored memo is itself errored — and **clears automatically** when a dependency changes and the getter next succeeds. Errors thrown by an **`effect`** are delivered up to the nearest boundary. Either way, you catch them in the same place: a `catchError`.

## API summary

| Export                                          | Signature                                            | Description                                                   |
| ----------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| `signal`                                        | `signal<T>(initial?) → (() => T) & ((v: T) => void)` | A reactive value; read with `()`, write with `(v)`.           |
| `computed`                                      | `computed<T>(getter) → () => T`                      | Lazy, cached derivation; an owner.                            |
| `effect`                                        | `effect(fn) → () => void`                            | Side effect that re-runs; returns a disposer.                 |
| `trigger`                                       | `trigger(fn) → void`                                 | Invalidate the signals read in `fn` without changing them.    |
| `root`                                          | `root(fn) → () => void`                              | Ownership scope; returns its disposer.                        |
| `onCleanup`                                     | `onCleanup(fn) → void`                               | Register teardown on the current owner.                       |
| `untrack`                                       | `untrack(fn) → T`                                    | Run `fn` without tracking reads.                              |
| `batch`                                         | `batch(fn) → T`                                      | Defer effects until `fn` returns, then flush.                 |
| `flushSync`                                     | `flushSync()` / `flushSync(fn)`                      | Drain now / run `fn` with synchronous scheduling.             |
| `getOwner` / `runWithOwner`                     | —                                                    | Capture / restore the active owner.                           |
| `createContext` / `getContext`/`setContext`     | —                                                    | Owner-tree context (Solid's model).                           |
| `catchError`                                    | `catchError<T>(fn, handler) → T \| undefined`        | Error boundary; routes throws in `fn`'s subtree to `handler`. |
| `CleanupFn`, `Owner`, `Context`, `ErrorHandler` | types                                                | Public types.                                                 |

## Scope — a core, not a framework

alien-signals is a minimal signal _core_; Solid is a full reactive _runtime_. VZN sits in between: alien's engine plus a Solid-style **owner tree** and async scheduling. It gives you the primitives and stays out of everything above them.

**Included:** signals, computeds, effects, `root` ownership + `onCleanup` + un-rooted auto-dispose, async batching with `batch` / `flushSync` escapes, `trigger`, `untrack`, owner-tree **context** (`createContext`/`getContext`/`setContext`), **error boundaries** (`catchError`), and owner capture (`getOwner` / `runWithOwner`).

**Deliberately not included** (and how to live without it):

| Solid has                             | VZN             | Notes                                                                       |
| ------------------------------------- | --------------- | --------------------------------------------------------------------------- |
| List reconciliation (`mapArray`)      | ✗ — _buildable_ | compose on `root`; returns a value + disposer in userland                   |
| Stores / deep reactivity              | ✗               | out of scope — compose signals yourself                                     |
| Async / Suspense / transitions        | ✗               | out of scope — needs a status lane the alien engine doesn't have            |
| Per-signal custom equality (`equals`) | ✗               | VZN compares strictly (`!==`); use [`trigger`](#trigger) to force an update |

vs **alien-signals**, VZN adds ownership, context, async batching, and flexible cleanup. vs **Solid**, VZN is the core — no JSX, stores, or resources — but it ships the ownership essentials (context included) and leaves the rest buildable on its owner tree. See [`docs/COMPARISON.md`](docs/COMPARISON.md) for the full breakdown.

## How it works

VZN runs its own instance of alien-signals' `createReactiveSystem` engine and layers a thin ownership model on top. The reactive operators are kept **as close to alien's `index.ts` as possible** — functions that are byte-for-byte identical (modulo flag literals) are marked `// Alien: VERBATIM` in the source, and every VZN-specific change is marked `// VZN:`. The whole library lives in a single `src/index.ts`.

Why a custom layer instead of using alien directly? Because alien is synchronous and has no ownership model. VZN reimplements just the write path (`scheduleFlush` instead of a synchronous `flush`) for async-default batching, and decouples the cleanup **owner** from the tracking **subscriber** so that `onCleanup` survives `untrack`, works inside memos, and cascades through `root`. See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the full breakdown and [`docs/COMPARISON.md`](docs/COMPARISON.md) for a detailed comparison with alien-signals and Solid.

## Contributing

Built with [Vite+](https://viteplus.dev). After cloning:

```sh
vp install      # install
vp check        # format, lint, type-check
vp test         # run the suite (core, utils, conformance)
```

Bug reports and pull requests are welcome at https://github.com/vznjs/reactivity. This project aims to be a safe, welcoming space; contributors are expected to follow the [Contributor Covenant](https://contributor-covenant.org).

## License

Open source under the [MIT License](http://opensource.org/licenses/MIT). Built on the shoulders of [alien-signals](https://github.com/stackblitz/alien-signals), Solid, S.js, and everyone whose reactivity work made this possible.
