import { createRoot } from "../src/root";
import { createValue } from "../src/value";
import { createReaction } from "../src/reaction";

jest.useFakeTimers('modern');

describe('root', () => {
  it("allows subcomputations to escape their parents", () => {
    createRoot(() => {
      const [getOuterSignal, setOuterSignal] = createValue(0);
      const [getInnerSignal, setInnerSignal] = createValue(0);
      const outerSpy = jest.fn();
      const innerSpy = jest.fn();
      
      createReaction(() => {
        getOuterSignal();
        outerSpy();

        createRoot(() => {
          createReaction(() => {
            getInnerSignal();
            innerSpy();
          });
        });
      });
      
      expect(outerSpy.mock.calls.length).toBe(1);
      expect(innerSpy.mock.calls.length).toBe(1);
      
      // trigger the outer computation, making more inners
      setOuterSignal(1);
      setOuterSignal(2);

      jest.runAllTimers();
      
      expect(outerSpy.mock.calls.length).toBe(2);
      expect(innerSpy.mock.calls.length).toBe(2);
      
      setInnerSignal(1);
      
      jest.runAllTimers();
      
      expect(outerSpy.mock.calls.length).toBe(2);
      expect(innerSpy.mock.calls.length).toBe(4);
    });
  });
  
  it("allows to dispose all nested computations", () => {
    const spy = jest.fn();

    createRoot((dispose) => {
      const [getSignal, setSignal] = createValue(1);
      
      createReaction(() => {
        getSignal();
        spy();
      });
      
      expect(spy.mock.calls.length).toBe(1);
      
      setSignal(2);

      jest.runAllTimers();
      
      expect(spy.mock.calls.length).toBe(2);

      dispose();
      
      setSignal(3);

      jest.runAllTimers();
      
      expect(spy.mock.calls.length).toBe(2);
    });
  });
});
