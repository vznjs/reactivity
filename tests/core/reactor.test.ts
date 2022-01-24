import { describe, test, vi, expect } from "vitest";
import { scheduleReactions, cancelReaction } from "../../src/core/reactor";
import { createReaction } from "../../src/core/reaction";

vi.useFakeTimers();

describe("scheduleReactions", () => {
  test("batches calls", () => {
    const spy = vi.fn();
    const reactionId = createReaction(spy);

    scheduleReactions([reactionId]);
    scheduleReactions([reactionId]);

    expect(spy.mock.calls.length).toBe(0);

    vi.runAllTimers();

    expect(spy.mock.calls.length).toBe(1);
  });

  test("works with nested schedules", () => {
    const spy = vi.fn();
    const reaction = createReaction(() => {
      const reaction2 = createReaction(() => spy("nested"));
      scheduleReactions([reaction2]);
      spy("flat");
    });

    scheduleReactions([reaction]);

    expect(spy.mock.calls.length).toBe(0);

    vi.runAllTimers();

    expect(spy.mock.calls.length).toBe(2);
    expect(spy.mock.calls[0][0]).toBe("flat");
    expect(spy.mock.calls[1][0]).toBe("nested");
  });
});

describe("cancelReaction", () => {
  test("unschedules a task", () => {
    const spy = vi.fn();
    const reaction = createReaction(spy);

    scheduleReactions([reaction]);
    cancelReaction(reaction);

    expect(spy.mock.calls.length).toBe(0);

    vi.runAllTimers();

    expect(spy.mock.calls.length).toBe(0);
  });
});
