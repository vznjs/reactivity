<p align="center">
  <img src="https://raw.githubusercontent.com/vznjs/reactivity/master/logo.png" alt="VZN Reactivity logo" />
</p>

# VZN | Reactivity

VZN makes your code reactive. It does things when other things change. When you get fired (action), you look to be hired (reaction). Let your code be just like you.

# Motivation

1. **I am learning about reactivity!** Everything else is only an excuse.
2. Most of the alternatives are so complex that it took me 6 months to figure out what they do and how they work.
3. I was inspired by all the solutions mentioned below, and I learned everything by going through their code and concepts. Kudos to the maintainers!
4. The usability of S.js is great, but its complexity and edge-cases were too overwhelming.
5. Solid.js reactivity is super performant, but it's not intuitive to use and tough to understand.
6. The Tagging in glimmer tracking is awesome, but the need for traversing the tree (reconcile) looks like a waste of CPU, and it's not scalable.
7. MobX - it's BIG. HUGE! and complex. In the beginning, it looked fine, but with time I lost myself fixing and thinking about reactivity in my code.

# Goals

🧱 **Simple** - Having 2-3 years of JS experience you should be able to understand it. Contact me if not!

📖 **Clean** - Read the code as a good book and learn something new.

🐣 **Small** - Less than 2kb (brottli)!

🧬 **Flexible** - No limitations, access to internal API (not private), build it yourself.

😎 **Intuitive** - Either you know how to use it, or you are doing it wrong.

🚀 **Fast** - Does only what needs to be done.

💎 **Modern** - Written in TS with full typings and modular structure.

🦴 **Independent** - No big company behind, no dependencies. Bare bones.

# Design

<img src="https://raw.githubusercontent.com/vznjs/reactivity/master/design.png" alt="VZN Architecture Design" />

# Compatibility

- Node v14 and above
- ES2020 (or transpile the code using your own target)

# Installation

```sh
npm install @vzn/reactivity
```

# Usage

This example shows off some of the capabilities of VZN | Reactivity.
The most important thing to learn here is that you need to wrap your "app" with `root()`, otherwise, all reactivity will be one-time only.

```js
import {
  root,
  createValue,
  createMemo,
  reactive,
  onCleanup,
} from "@vzn/reactivity";

root((dispose) => {
  console.log("Reactivity is turned on!");

  setTimeout(dispose, 1000); // Turn off reactive system in 1s

  onCleanup(() => console.log("Reactivity is turned off!")); // log this message on dispose

  const [getName, setName] = createValue("VZN");

  const greetings = createMemo(() => `Hey ${getName()}!`);

  reactive(() => {
    console.log(greetings()); // Log greetings every time they will change
  });

  // LOG: Hey VZN!

  setName("Maciej");

  // LOG: Hey Maciej!

  // after 1s: LOG: Reactivity is turned off!
});
```

# Examples & Resources

- [Counter](https://codesandbox.io/s/counter-1h4ve?file=/src/index.ts)
- [Counter as component](https://codesandbox.io/s/counter-as-component-iw6mj?file=/src/index.ts)
- [State management](https://codesandbox.io/s/authentication-o87py?file=/src/index.ts)

# High-level API

This API should be perceived as public, and you should feel free to use it in your implementations.

## `createValue`

Reactive values are used as atoms for computations (e.g., reactions and memos). They work synchronously, which means their updates are available immediately, and in the "background" they inform computations about a change.

```js
import { createValue } from "@vzn/reactivity";

const [getName, setName] = createValue("VZN");

getName(); // VZN
setName("Maciej");
getName(); // Maciej
```

By default, updating a reactive value to the same value (e.g., 'vzn' to 'vzn') will not trigger any updates.

If you wish to trigger a change on every update use `createValue(value, false)` or pass your own compare function

```js
createValue(value, (oldValue, newValue) => oldValue == newValue);
```

## `reactive`

A reactive block will make your code reactive. Change of any reactive value used in that block will make the code recompute. This gives you a granular reactivity and a place to call side effects.

```js
import { reactive, createValue } from "@vzn/reactivity";

const button = document.createElement("button");
const [getName, setName] = createValue("VZN");

reactive(() => {
  console.log("Say my name:", getName());
});

// LOG: Say my name: VZN

setName("Maciej");

// LOG: Say my name: Maciej
```

## `root`

A root is the most important block in reactivity. It defines the owner of the whole reactivity tree. When you plan to make some part of your code reactive, create a top-level Root (e.g., around your entire app). The Root is yielding a disposer function which you can use to dispose of all reactive computations.

```js
import { root, createValue, react } from "@vzn/reactivity";

root((dispose) => {
  const [getName] = createValue("VZN");

  reactive(() => {
    console.log(getName());
  });

  // ...

  // Call dispose() whenever you want to close the root
  // or never call it, in case you want to have it working forever
  // dispose();
});
```

The created reaction will live (react) until the Root's dispose will be called.

If you did not create the Root, the reaction would be automatically disposed of at the end of your code execution (end of the micro queue).

## `createMemo`

A memo is like a mix of reaction and reactive value. It recomputes only when accessed and only if changed.

```js
import { createMemo, reactive, createValue } from "@vzn/reactivity";

const [getName, setName] = createValue("VZN");

const getGreetings = createMemo(() => `Hey ${getName()}!`); // It does not compute just yet

getGreetings(); // First usage runs the computation

// The reaction will not recompute the memo as it has been already calculated
reactive(() => {
  console.log(getGreetings());
});

// LOG: Hey VZN!

setName("Maciej"); // Triggers computation which recomputes the memo directly

// LOG: Hey Maciej!
```

## `onCleanup`

Use onCleanup for scheduling a task that will be run before the computation recomputes or is scheduled for root's disposal.

```js
import { reactive, createValue, onCleanup } from "@vzn/reactivity";

const button = document.createElement("button");
const [getEvent, setEvent] = createValue("click");

reactive(() => {
  const eventType = getEvent();
  const action = () => console.log("I did something!");

  button.addEventListener(eventType, action);

  onCleanup(() => button.removeEventListener(eventType, action));
});

setEvent("mouseover");
```

## `freeze`

By using `freeze` you can get the value without setting a dependency on the current reaction or memo (computation) which means that they will not recompute in case values inside of `freeze` will change.

```js
import { reactive, createValue } from "@vzn/reactivity";

const [getName, setName] = createValue("VZN");

reactive(() => {
  freeze(() => {
    console.log(getName());
  });
});

// LOG: VZN

setName(
  "This will not trigger the reaction as getName() was not tracked in the reaction"
);
```

## `on`

`on` is designed to be passed into a `reactive` to make its dependencies explicit.

```js
import { reactive, on, createValue } from "@vzn/reactivity";

const [getName, setName] = createValue("Hello");

reactive(on(getName, (v) => console.log("Name has changed!")));

// is equivalent to:
reactive(() => {
  getName();
  freeze(() => console.log("Name has changed!"));
});
```

You can also not run the reaction immediately and instead opt in for it to only run on change by setting the defer option to true.

```js
reactive(on(getName, (v) => console.log("Name has changed!"), true));
```

# TO DO

- [ ] full reactivity for objects and arrays
- [ ] `reactive` decorator?
- [ ] document low-level API

# Contributing

Bug reports and pull requests are welcome on GitHub at https://github.com/vznjs/reactivity. This project is intended to be a safe, welcoming space for collaboration, and contributors are expected to adhere to the [Contributor Covenant](contributor-covenant.org) code of conduct.

# License

This version of the package is available as open source under the terms of the [MIT License](http://opensource.org/licenses/MIT).
