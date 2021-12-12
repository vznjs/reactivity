import { createAtom } from "../../src/core/atom";
import { scheduleAtom, cancelReaction } from "../../src/core/reactor";
import { createReaction } from "../../src/core/reaction";
import { trackAtom } from "../../src/core/tracking";

jest.useFakeTimers("modern");

describe("scheduleAtom", () => {
  it("batches calls", () => {
    const spy = jest.fn();
    const reaction = createReaction(spy);
    const atom = createAtom();

    trackAtom(atom, reaction);

    scheduleAtom(atom);
    scheduleAtom(atom);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
  });

  it("works with nested schedules", () => {
    const spy = jest.fn();
    const atom = createAtom();
    const reaction = createReaction(() => {
      trackAtom(
        atom,
        createReaction(() => spy("nested"))
      );
      scheduleAtom(atom);
      spy("flat");
    });

    trackAtom(atom, reaction);

    scheduleAtom(atom);

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
    const reaction = createReaction(spy);
    const atom = createAtom();

    trackAtom(atom, reaction);
    scheduleAtom(atom);
    cancelReaction(reaction);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(0);
  });
});

describe("startReactor", () => {
  it("runs reactions always in creation order", () => {
    const spy = jest.fn();
    const reaction1 = createReaction(() => spy(1));
    const reaction2 = createReaction(() => spy(2));
    const atom1 = createAtom();
    const atom2 = createAtom();

    trackAtom(atom1, reaction1);
    trackAtom(atom1, reaction2);
    trackAtom(atom2, reaction2);

    scheduleAtom(atom2);
    scheduleAtom(atom1);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(2);
    expect(spy.mock.calls[0][0]).toBe(1);
    expect(spy.mock.calls[1][0]).toBe(2);
  });
});
