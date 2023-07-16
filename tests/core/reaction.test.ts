import { describe, it, expect, vi } from "vitest";
import {
  createReaction,
  runReaction,
  deleteReaction,
  getReaction,
} from "../../src";

describe("createReaction", () => {
  it("returns unique id incrementally", () => {
    const spy = vi.fn();
    const reaction1 = createReaction({ compute: spy });
    const reaction2 = createReaction({ compute: spy });

    expect(reaction1).toBeGreaterThan(0);
    expect(reaction2).toBe(reaction1 + 1);
  });
});

describe("runReaction", () => {
  it("runs created reaction", () => {
    const spy = vi.fn();
    const reactionId = createReaction({ compute: spy });

    expect(spy).toBeCalledTimes(0);
    runReaction(reactionId);
    expect(spy).toBeCalledTimes(1);
  });
});

describe("deleteReaction", () => {
  it("removes reaction", () => {
    const spy = vi.fn();
    const reactionContext = { compute: spy };
    const reactionId = createReaction(reactionContext);

    expect(getReaction(reactionId)).toBe(reactionContext);
    deleteReaction(reactionId);
    expect(getReaction(reactionId)).toBeUndefined();
  });
});
