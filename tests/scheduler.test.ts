import { scheduleUpdate, unscheduleComputation } from "../src/scheduler";
import { createSignal } from "../src/signal";

jest.useFakeTimers("modern");

describe("scheduleUpdate", () => {
  it("batches calls", () => {
    const spy = jest.fn();
    const signal = createSignal();

    scheduleUpdate(signal, [spy]);
    scheduleUpdate(signal, [spy]);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
  });

  it("works with nested schedules", () => {
    const spy = jest.fn();
    const signal = createSignal();
    const computation = () => {
      scheduleUpdate(signal, [() => spy("nested")]);
      spy("flat");
    };

    scheduleUpdate(signal, [computation]);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(2);
    expect(spy.mock.calls[0][0]).toBe("flat");
    expect(spy.mock.calls[1][0]).toBe("nested");
  });
});

describe("unscheduleComputation", () => {
  it("unschedules a task", () => {
    const spy = jest.fn();
    const signal = createSignal();

    scheduleUpdate(signal, [spy]);
    unscheduleComputation(spy);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(0);
  });
});
