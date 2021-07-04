import { scheduleAtomReactions, cancelReaction } from "../src/reactor";
import { createAtom } from "../src/atom";

jest.useFakeTimers("modern");

describe("scheduleAtomReactions", () => {
  it("batches calls", () => {
    const spy = jest.fn();
    const atom = createAtom();

    scheduleAtomReactions(atom, [spy]);
    scheduleAtomReactions(atom, [spy]);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
  });

  it("works with nested schedules", () => {
    const spy = jest.fn();
    const atom = createAtom();
    const reaction = () => {
      scheduleAtomReactions(atom, [() => spy("nested")]);
      spy("flat");
    };

    scheduleAtomReactions(atom, [reaction]);

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

    scheduleAtomReactions(atom, [spy]);
    cancelReaction(spy);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(0);
  });
});
