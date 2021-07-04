import { createRoot } from "../src/root";
import { createValue } from "../src/value";
import { createReaction } from "../src/reaction";

jest.useFakeTimers("modern");

describe("root", () => {
  it("allows subreactions to escape their parents", () => {
    createRoot(() => {
      const [getOuterAtom, setOuterAtom] = createValue(0);
      const [getInnerAtom, setInnerAtom] = createValue(0);
      const outerSpy = jest.fn();
      const innerSpy = jest.fn();

      createReaction(() => {
        getOuterAtom();
        outerSpy();

        createRoot(() => {
          createReaction(() => {
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

      jest.runAllTimers();

      expect(outerSpy.mock.calls.length).toBe(2);
      expect(innerSpy.mock.calls.length).toBe(2);

      setInnerAtom(1);

      jest.runAllTimers();

      expect(outerSpy.mock.calls.length).toBe(2);
      expect(innerSpy.mock.calls.length).toBe(4);
    });
  });

  it("allows to dispose all nested reactions", () => {
    const spy = jest.fn();

    createRoot((dispose) => {
      const [getAtom, setAtom] = createValue(1);

      createReaction(() => {
        getAtom();
        spy();
      });

      expect(spy.mock.calls.length).toBe(1);

      setAtom(2);

      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(2);

      dispose();

      setAtom(3);

      jest.runAllTimers();

      expect(spy.mock.calls.length).toBe(2);
    });
  });
});
