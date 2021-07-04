import { runWithContext } from "../../src/core/context";
import { createAtom, trackAtom } from "../../src/core/atom";
import { scheduleAtomReactions, cancelReaction } from "../../src/core/reactor";

jest.useFakeTimers("modern");

describe("scheduleAtomReactions", () => {
  it("batches calls", () => {
    const spy = jest.fn();
    const atom = createAtom();

    runWithContext({ reaction: spy }, () => trackAtom(atom));

    scheduleAtomReactions(atom);
    scheduleAtomReactions(atom);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
  });

  it("works with nested schedules", () => {
    const spy = jest.fn();
    const atom = createAtom();
    const reaction = () => {
      runWithContext({ reaction: () => spy("nested") }, () => trackAtom(atom));
      scheduleAtomReactions(atom);
      spy("flat");
    };

    runWithContext({ reaction }, () => trackAtom(atom));

    scheduleAtomReactions(atom);

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

    runWithContext({ reaction: spy }, () => trackAtom(atom));
    scheduleAtomReactions(atom);
    cancelReaction(spy);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(0);
  });
});
