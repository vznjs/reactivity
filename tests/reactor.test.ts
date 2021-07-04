import { scheduleReactions, cancelReaction } from "../src/reactor";
import { createAtom } from "../src/atom";

jest.useFakeTimers("modern");

describe("scheduleReactions", () => {
  it("batches calls", () => {
    const spy = jest.fn();
    const atom = createAtom();

    scheduleReactions(atom, [spy]);
    scheduleReactions(atom, [spy]);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
  });

  it("works with nested schedules", () => {
    const spy = jest.fn();
    const atom = createAtom();
    const computation = () => {
      scheduleReactions(atom, [() => spy("nested")]);
      spy("flat");
    };

    scheduleReactions(atom, [computation]);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(2);
    expect(spy.mock.calls[0][0]).toBe("flat");
    expect(spy.mock.calls[1][0]).toBe("nested");
  });
});

describe("cancelReaction", () => {
  it("unschedules a task", () => {
    const spy = jest.fn();
    const atom = createAtom();

    scheduleReactions(atom, [spy]);
    cancelReaction(spy);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(0);
  });
});
