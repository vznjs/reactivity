import { describe, it, expect } from "vite-plus/test";
import {
  testSuite,
  SkipTest,
  setExpect,
  type ReactiveFramework,
} from "reactive-framework-test-suite";
import { signal, computed, effect, root, batch, flushSync, untracked } from "../src/index";

setExpect(expect);

const framework: ReactiveFramework = {
  name: "vzn",
  signal(initialValue) {
    const s = signal(initialValue);
    return { read: s, write: s };
  },
  computed(fn) {
    return { read: computed(fn) };
  },
  effect,
  run: (fn) => flushSync(() => root(fn)),
  batch,
  untracked,
};

for (const { section, cases } of testSuite) {
  describe(`conformance: ${section}`, () => {
    for (const [name, fn] of Object.entries(cases)) {
      it(name, () => {
        try {
          framework.run(() => fn(framework));
        } catch (e) {
          if (e instanceof SkipTest) return;
          throw e;
        }
      });
    }
  });
}
