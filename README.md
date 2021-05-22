# VZN | Reactivity

# Motivation

# Compatibility

- Node v14 and above
- Chrome, Firefox, Safari
- Other? Transpile the code yourself, use polyfills.

# Installation

```sh
npm install @vzn/reactivity
```

# High-level API

## `createValue`

Reactive values are used as signals for computations (eg, reactions and memos). They work in synchronous way, which means their updates are immediately available and in the "background" they are informing computations about a change.

```js
import { createValue } from "@vzn/reactivity";

const [getName, setName] = createValue("VZN");

getName(); // VZN
setName("Maciej");
getName(); // Maciej
```

By default, updating a reactive value to the same value eg, 'vzn' to 'vzn', will not trigger any updates.

If you wish to signal a change on every update use `createValue(value, false)` or pass your own compare function

```js
createValue(value, (oldValue, newValue) => oldValue == newValue);
```

## `createReaction`

Reaction will make your block code reactive. This means, every time some reactive value that has been used will change, the code will recompute. This will allow you to create granular reactivity or set side effects.

```js
import { createReaction, createValue } from "@vzn/reactivity";

const button = document.createElement("button");
const [getName, setName] = createValue("VZN");

createReaction(() => {
  console.log("Say my name:", getName());
});

// LOG: Say my name: VZN

setName("Maciej");

// LOG: Say my name: Maciej
```

## `createRoot`

Root is the most important block in reactivity. It defines the owner of the whole reactivity tree. When you plan to make some part of your code reactive, eg your whole app, create a top-level Root as the owner. The Root is yielding a disposer function which you can use dispose all reactive computations.

```js
import { createRoot, createValue, createReaction } from "@vzn/reactivity";

createRoot((dispose) => {
  const [getName] = createValue("VZN");

  createReaction(() => {
    console.log(getName());
  });

  // ...

  // Call dispose() whenever you want to close the root
  // or never call it, in case you want to have it working forever
  // dispose();
});
```

The created reaction will live (react) until the Root's dispose will be called.

If you would not create the Root, the reaction would be automatically disposed at the end of your code execution (end of micro queue).

## `createMemo`

Memo is like a mix of on-demand reaction and reactive value. If the reactive values used inside of it will change, it will know that it needs to recompute but it will wait until the next usage, at the same time informing all it's dependents that it has been changed. Sounds complex? But it's actually super intuitive.

```js
import { createMemo, createReaction, createValue } from "@vzn/reactivity";

const [getName, setName] = createValue("VZN");

const getGreetings = createMemo(() => `Hey ${getName()}!`); // it does not compute just yet

getGreetings(); // First usage runs the computation

createReaction(() => {
  console.log(getGreetings()); // it recomputes only if memo has changed
});

// LOG: Hey VZN!

setName("Maciej");

getGreetings(); // It's dependency changed so this usage will recompute it again

// LOG: Hey Maciej!
```

## `onCleanup`

Use onCleanup for scheduling a task which will be run before the computation will recompute or when it will be scheduled for disposal.

```js
import { createReaction, createValue, onCleanup } from "@vzn/reactivity";

const button = document.createElement("button");
const [getEvent, setEvent] = createValue("click");

createReaction(() => {
  const eventType = getEvent();
  const action = () => console.log("I did something!");

  button.addEventListener(eventType, action);

  onCleanup(() => button.removeEventListener(eventType, action));
});

setEvent("mouseover");
```

## `untrack`

By using `untrack` you can get the value without setting a dependency on current computation (reaction).

```js
import { createReaction, createValue } from "@vzn/reactivity";

const [getName, setName] = createValue("VZN");

createReaction(() => {
  untrack(() => {
    console.log(getName());
  });
});

// LOG: VZN

setName("This will not trigger the reaction!");
```

# Low-level API

This API has been used to create a High-level API. It is discouraged to use it directly in your features. It should serve as a way to create a new custom High-level API if needed. Eg. if you think you need your own `createMemo` implementation, you can do it yourself by using this API.

## `createSignal`

Signal is the smallest reactive primitive. It's role is to track and notify about changes.

```js
import { createSignal, createReaction } from "@vzn/reactivity";

const mySignal = createSignal();

createReaction(() => {
  mySignal.track(); // track and remember the computation
});

mySignal.notify(); // notify all computations about a change (the reaction will be scheduled for recomputation)
```

## `schedule`

It allows you to schedule some tasks in microtasks queue (after your code has been executed), respecting the order of other tasks and throwing possible errors in async (non-blocking) way.

```js
import { schedule } from "@vzn/reactivity";

console.log("Sync1");
schedule(() => console.log("Async"));
console.log("Sync2");

// LOG: Sync1
// LOG: Sync2
// LOG: Async
```

## `createQueue`

It creates a queue of unique tasks with `Set<() => void>` interface. It can be used as context's disposer.

```js
import { createQueue } from "@vzn/reactivity";

const myDisposer = createQueue();

myDisposer.add(() => console.log("clean me"));
```

## `flushQueue`

It flushes the queue of tasks with async errors handling and detached Reactive Context.

```js
import { createQueue, flushQueue } from "@vzn/reactivity";

const myDisposer = createQueue();

myDisposer.add(() => console.log("clean me"));

flushQueue(myDisposer);

// LOG: clean me
```

## `getContext`

It returns current Reactive Context. Useful, for retrieving current computation and disposer, as well as remembering the context eg for async operations.

```js
import { getContext } from "@vzn/reactivity";

const currentContext = getContext(); // { disposer?: Set<() => void>, computation?: () => void}
```

## `runWithContext`

It merges passed computation and disposer with current Context, creating a new one and running passed function with it.

```js
import { runWithContext } from "@vzn/reactivity";

runWithContext({ disposer: undefined }, () => {
  console.log("I have no disposer but I still use the inherited computation");
});
```

# Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/vznjs/reactivity. This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the [Contributor Covenant](contributor-covenant.org) code of conduct.

# License

This version of the package is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).
