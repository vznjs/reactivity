import { schedule, unschedule } from "../src/scheduler";

jest.useFakeTimers("modern");

describe("schedule", () => {
  it("batches calls", () => {
    const spy = jest.fn();

    schedule(spy);
    schedule(spy);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
  });

  it("works with nested schedules", () => {
    const spy = jest.fn();

    schedule(() => {
      schedule(() => spy("nested"));
      spy("flat");
    });

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(2);
    expect(spy.mock.calls[0][0]).toBe("flat");
    expect(spy.mock.calls[1][0]).toBe("nested");
  });
});

describe("unschedule", () => {
  it("unschedules a task", () => {
    const spy = jest.fn();

    schedule(spy);
    unschedule(spy);

    expect(spy.mock.calls.length).toBe(0);

    jest.runAllTimers();

    expect(spy.mock.calls.length).toBe(0);
  });
});
