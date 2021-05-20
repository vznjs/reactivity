import { untrack } from "../src/untrack";
import { onCleanup } from "../src/disposer";
import { getContext, runWithContext } from "../src/context";
import { createQueue, flushQueue } from "../src/queue";

jest.useFakeTimers("modern");

describe("untrack", () => {
  it("runs without any computation", () => {
    const computation = () => {
      // dummy
    };

    expect(getContext().computation).toBeUndefined();

    runWithContext({ computation }, () => {
      expect(getContext().computation).toBe(computation);

      untrack(() => {
        expect(getContext().computation).toBeUndefined();
      });

      expect(getContext().computation).toBe(computation);
    });

    expect(getContext().computation).toBeUndefined();
  });

  it("runs cleanups in computation correctly", () => {
    const disposer = createQueue();
    const cleanupMock = jest.fn();

    expect(getContext().disposer).toBeUndefined();

    runWithContext({ disposer }, () => {
      untrack(() => {
        onCleanup(cleanupMock);
      });
    });

    expect(cleanupMock.mock.calls.length).toBe(0);

    flushQueue(disposer);

    expect(cleanupMock.mock.calls.length).toBe(1);
  });
});
