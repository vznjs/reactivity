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

## `createSignal`

## `schedule`

## `createQueue`

## `flushQueue`

## `getContext`

## `runWithContext`

# Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/vznjs/reactivity. This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the [Contributor Covenant](contributor-covenant.org) code of conduct.

# License

This version of the package is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).

<iframe src="https://codesandbox.io/embed/eloquent-hoover-iw6mj?autoresize=1&fontsize=14&hidenavigation=1&module=%2Fsrc%2Findex.ts&theme=dark&view=editor"
     style="width:100%; height:500px; border:0; border-radius: 4px; overflow:hidden;"
     title="eloquent-hoover-iw6mj"
     allow="accelerometer; ambient-light-sensor; camera; encrypted-media; geolocation; gyroscope; hid; microphone; midi; payment; usb; vr; xr-spatial-tracking"
     sandbox="allow-forms allow-modals allow-popups allow-presentation allow-same-origin allow-scripts"
   ></iframe>
