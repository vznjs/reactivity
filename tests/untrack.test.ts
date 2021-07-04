import { untrack } from "../src/untrack";
import { createDisposer, flushDisposer, onCleanup } from "../src/disposer";
import { getContext, runWithContext } from "../src/context";

jest.useFakeTimers("modern");

describe("untrack", () => {
  it("runs without any reaction", () => {
    const reaction = () => {
      // dummy
    };

    expect(getContext().reaction).toBeUndefined();

    runWithContext({ reaction }, () => {
      expect(getContext().reaction).toBe(reaction);

      untrack(() => {
        expect(getContext().reaction).toBeUndefined();
      });

      expect(getContext().reaction).toBe(reaction);
    });

    expect(getContext().reaction).toBeUndefined();
  });

  it("runs cleanups in reaction correctly", () => {
    const disposer = createDisposer();
    const cleanupMock = jest.fn();

    expect(getContext().disposer).toBeUndefined();

    runWithContext({ disposer }, () => {
      untrack(() => {
        onCleanup(cleanupMock);
      });
    });

    expect(cleanupMock.mock.calls.length).toBe(0);

    flushDisposer(disposer);

    expect(cleanupMock.mock.calls.length).toBe(1);
  });
});
