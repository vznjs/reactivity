import { freeze } from "../src/freeze";
import { createDisposer, flushDisposer, onCleanup } from "../src/disposer";
import { getContext, runWithContext } from "../src/context";

jest.useFakeTimers("modern");

describe("freeze", () => {
  it("runs without any reaction", () => {
    const reaction = () => {
      // dummy
    };

    expect(getContext().reaction).toBeUndefined();

    runWithContext({ reaction }, () => {
      expect(getContext().reaction).toBe(reaction);

      freeze(() => {
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
      freeze(() => {
        onCleanup(cleanupMock);
      });
    });

    expect(cleanupMock.mock.calls.length).toBe(0);

    flushDisposer(disposer);

    expect(cleanupMock.mock.calls.length).toBe(1);
  });
});
