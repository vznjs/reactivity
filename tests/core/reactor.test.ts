import { describe, it, vi, expect } from "vitest";
import { scheduleReactions, cancelReaction } from "../../src/core/reactor";
import { createReaction } from "../../src/core/reaction";

vi.useFakeTimers();

describe("scheduleReactions", () => {
  it("batches calls", async () => {
    const spy = vi.fn();
    const reactionId = createReaction({ compute: spy });

    scheduleReactions([reactionId]);
    scheduleReactions([reactionId]);

    expect(spy).toBeCalledTimes(0);

    await Promise.resolve();

    expect(spy).toBeCalledTimes(1);
  });

  it("works with nested schedules", async () => {
    const spy = vi.fn();
    const reaction = createReaction({
      compute: () => {
        const reaction2 = createReaction({ compute: () => spy("nested") });
        scheduleReactions([reaction2]);
        spy("flat");
      },
    });

    scheduleReactions([reaction]);

    expect(spy.mock.calls.length).toBe(0);

    await Promise.resolve();

    expect(spy.mock.calls.length).toBe(2);
    expect(spy.mock.calls[0][0]).toBe("flat");
    expect(spy.mock.calls[1][0]).toBe("nested");
  });
});

describe("cancelReaction", () => {
  it("unschedules a task", async () => {
    const spy = vi.fn();
    const reaction = createReaction({ compute: spy });

    scheduleReactions([reaction]);
    cancelReaction(reaction);

    expect(spy.mock.calls.length).toBe(0);

    await Promise.resolve();

    expect(spy.mock.calls.length).toBe(0);
  });
});
