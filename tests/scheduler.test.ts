import { scheduleUpdate, cancelComputation } from "../src/scheduler";
import { createAtom } from "../src/atom";

jest.useFakeTimers("modern");

describe("scheduleUpdate", () => {
  it("batches calls", () => {
    const spy = jest.fn();
    const atom = createAtom();

    scheduleUpdate(atom, [spy]);
    scheduleUpdate(atom, [spy]);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
  });

  it("works with nested schedules", () => {
    const spy = jest.fn();
    const atom = createAtom();
    const computation = () => {
      scheduleUpdate(atom, [() => spy("nested")]);
      spy("flat");
    };

    scheduleUpdate(atom, [computation]);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(2);
    expect(spy.mock.calls[0][0]).toBe("flat");
    expect(spy.mock.calls[1][0]).toBe("nested");
  });
});

describe("cancelComputation", () => {
  it("unschedules a task", () => {
    const spy = jest.fn();
    const atom = createAtom();

    scheduleUpdate(atom, [spy]);
    cancelComputation(spy);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(0);
  });
});
