import { describe, it, vi, expect } from "vitest";
import { createOwner, runWithOwner } from "../../src/core/owner";
import { createValue } from "../../src/state/value";
import { reactive } from "../../src/utils/reactive";
import { root } from "../../src/utils/root";
import { createDisposer, flushDisposer } from "../../src/core/disposer";
import { createReaction } from "../../src/core/reaction";
import { onCleanup } from "../../src/utils/on-cleanup";

describe("createValue", () => {
  it("takes and returns an initial value", () => {
    const [getValue] = createValue(1);
    expect(getValue()).toBe(1);
  });

  it("can be set by passing in a new value", () => {
    const [getValue, setValue] = createValue(1);
    setValue(2);
    expect(getValue()).toBe(2);
  });

  it("triggers reaction if values are not equal", async () => {
    const spy = vi.fn();
    const reactionId = createReaction({ compute: spy });
    const [getAtom, setAtom] = createValue(false);

    runWithOwner(createOwner({ disposerId: undefined, reactionId }), () =>
      getAtom(),
    );

    expect(spy.mock.calls.length).toBe(0);
    expect(getAtom()).toBe(false);

    setAtom(true);

    expect(spy.mock.calls.length).toBe(0);

    await Promise.resolve();

    expect(spy.mock.calls.length).toBe(1);
    expect(getAtom()).toBe(true);
  });

  it("triggers reaction if compare option is false and values are equal", async () => {
    const spy = vi.fn();
    const reactionId = createReaction({ compute: spy });
    const [getAtom, setAtom] = createValue(true, false);

    runWithOwner(createOwner({ disposerId: undefined, reactionId }), () =>
      getAtom(),
    );

    expect(spy.mock.calls.length).toBe(0);

    setAtom(true);

    expect(spy.mock.calls.length).toBe(0);

    await Promise.resolve();

    expect(spy.mock.calls.length).toBe(1);
  });

  it("does not trigger reaction if set to equal value", () => {
    const spy = vi.fn();
    const reactionId = createReaction({ compute: spy });
    const [getAtom, setAtom] = createValue(false);

    root(async () => {
      runWithOwner(createOwner({ disposerId: undefined, reactionId }), () =>
        getAtom(),
      );

      expect(spy.mock.calls.length).toBe(0);
      expect(getAtom()).toBe(false);

      setAtom(false);

      expect(spy.mock.calls.length).toBe(0);
      expect(getAtom()).toBe(false);

      await Promise.resolve();

      expect(spy.mock.calls.length).toBe(0);
      expect(getAtom()).toBe(false);

      setAtom(true);

      await Promise.resolve();

      expect(spy.mock.calls.length).toBe(1);
      expect(getAtom()).toBe(true);
    });
  });

  it("can take an equality predicate", () => {
    const spy = vi.fn();
    const reactionId = createReaction({ compute: spy });
    const [getAtom, setAtom] = createValue([1], (a, b) => a[0] === b[0]);

    root(async () => {
      runWithOwner(createOwner({ disposerId: undefined, reactionId }), () =>
        getAtom(),
      );

      expect(spy.mock.calls.length).toBe(0);

      setAtom([1]);

      await Promise.resolve();

      expect(spy.mock.calls.length).toBe(0);

      setAtom([2]);

      await Promise.resolve();

      expect(spy.mock.calls.length).toBe(1);
    });
  });

  it("removes subscriptions on cleanup", async () => {
    const spy = vi.fn();
    const reactionId = createReaction({ compute: spy });
    const [getAtom, setAtom] = createValue(false);
    const disposerId = createDisposer();

    runWithOwner(createOwner({ disposerId, reactionId }), () => getAtom());

    setAtom(true);

    expect(spy.mock.calls.length).toBe(0);

    await Promise.resolve();

    expect(spy.mock.calls.length).toBe(1);
    expect(getAtom()).toBe(true);

    flushDisposer(disposerId);

    setAtom(false);

    expect(spy.mock.calls.length).toBe(1);
    expect(getAtom()).toBe(false);
  });

  it("ignores reaction with circular dependencies", async () => {
    const spy = vi.fn();
    const reactionId = createReaction({ compute: spy });
    const [getAtom, setAtom] = createValue(0);
    const disposerId = createDisposer();

    runWithOwner(createOwner({ disposerId, reactionId }), () =>
      setAtom(getAtom() + 1),
    );

    expect(spy.mock.calls.length).toBe(0);
    expect(getAtom()).toBe(1);

    setAtom(getAtom() + 1);

    await Promise.resolve();

    expect(spy.mock.calls.length).toBe(1);
    expect(getAtom()).toBe(2);
  });

  it("uses global queue of updates (aka S.js subclocks)", async () => {
    const spy = vi.fn();
    const [getAtom, setAtom] = createValue(20);

    root(() => {
      reactive(() => {
        while (getAtom() <= 10) {
          setAtom(getAtom() + 1);
        }
      });

      reactive(() => spy(getAtom()));
    });

    expect(spy.mock.calls.length).toBe(1);

    await Promise.resolve();

    expect(spy.mock.calls.length).toBe(1);

    setAtom(5);
    await Promise.resolve();

    expect(spy.mock.calls.length).toBe(2);
  });

  it("works with cross-updates", () => {
    const spy = vi.fn();
    const [getData, setData] = createValue(2);
    const [getData2, setData2] = createValue(2);

    root(async () => {
      reactive(() => {
        getData2();
        spy();
      });

      reactive(() => {
        setData2(getData() + 1);
      });

      expect(spy.mock.calls.length).toBe(1);

      await Promise.resolve();

      expect(spy.mock.calls.length).toBe(2);

      setData(5);
      await Promise.resolve();

      expect(spy.mock.calls.length).toBe(3);
    });
  });

  it("works with nested updates and cleanups", () => {
    const spy = vi.fn();
    const spy2 = vi.fn();
    const [getData, setData] = createValue(1);
    const disposerId = createDisposer();

    root(async () => {
      reactive(() => {
        onCleanup(() => flushDisposer(disposerId));
        getData();
        spy();
      });

      runWithOwner(createOwner({ disposerId, reactionId: undefined }), () => {
        reactive(() => {
          getData();
          spy2();
        });
      });

      expect(spy.mock.calls.length).toBe(1);
      expect(spy2.mock.calls.length).toBe(1);

      await Promise.resolve();

      expect(spy.mock.calls.length).toBe(1);
      expect(spy2.mock.calls.length).toBe(1);

      setData(2);

      expect(spy.mock.calls.length).toBe(1);
      expect(spy2.mock.calls.length).toBe(1);

      await Promise.resolve();

      expect(spy.mock.calls.length).toBe(2);
      expect(spy2.mock.calls.length).toBe(1);
    });
  });

  it("does not recompute reactions used after change", async () => {
    const spy = vi.fn();
    const [getAtom, setAtom] = createValue(false);

    root(() => {
      setAtom(true);

      reactive(() => {
        getAtom();
        spy();
      });
    });

    expect(spy.mock.calls.length).toBe(1);

    await Promise.resolve();

    expect(spy.mock.calls.length).toBe(1);
  });
});
