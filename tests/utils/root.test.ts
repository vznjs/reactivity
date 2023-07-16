import { describe, it, vi, expect } from "vitest";
import { createValue } from "../../src/state/value";
import { reactive } from "../../src/utils/reactive";
import { root } from "../../src/utils/root";

describe("root", () => {
  it("allows subreactions to escape their parents", () => {
    root(async () => {
      const [getOuterAtom, setOuterAtom] = createValue(0);
      const [getInnerAtom, setInnerAtom] = createValue(0);
      const outerSpy = vi.fn();
      const innerSpy = vi.fn();

      reactive(() => {
        getOuterAtom();
        outerSpy();

        root(() => {
          reactive(() => {
            getInnerAtom();
            innerSpy();
          });
        });
      });

      expect(outerSpy.mock.calls.length).toBe(1);
      expect(innerSpy.mock.calls.length).toBe(1);

      // trigger the outer reaction, making more inners
      setOuterAtom(1);
      setOuterAtom(2);

      await Promise.resolve();

      expect(outerSpy.mock.calls.length).toBe(2);
      expect(innerSpy.mock.calls.length).toBe(2);

      setInnerAtom(1);

      await Promise.resolve();

      expect(outerSpy.mock.calls.length).toBe(2);
      expect(innerSpy.mock.calls.length).toBe(4);
    });
  });

  it("allows to dispose all nested reactions", () => {
    const spy = vi.fn();

    root(async (dispose) => {
      const [getAtom, setAtom] = createValue(1);

      reactive(() => {
        getAtom();
        spy();
      });

      expect(spy.mock.calls.length).toBe(1);

      setAtom(2);

      await Promise.resolve();

      expect(spy.mock.calls.length).toBe(2);

      dispose();

      setAtom(3);

      await Promise.resolve();

      expect(spy.mock.calls.length).toBe(2);
    });
  });
});
