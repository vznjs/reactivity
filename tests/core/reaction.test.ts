import { describe, it, expect, vi } from "vitest";
import {
  createReaction,
  getComputation,
  destroyReaction,
} from "../../src/core/reaction";

describe("createReaction", () => {
  it("returns unique id incrementally", () => {
    const spy = vi.fn();
    const reaction1 = createReaction(spy);
    const reaction2 = createReaction(spy);

    expect(reaction1).toBeGreaterThan(0);
    expect(reaction2).toBe(reaction1 + 1);
  });
});

describe("getComputation", () => {
  it("returns registered computations", () => {
    const spy1 = vi.fn();
    const spy2 = vi.fn();
    const reaction1 = createReaction(spy1);
    const reaction2 = createReaction(spy2);

    expect(getComputation(reaction1)).toBe(spy1);
    expect(getComputation(reaction2)).toBe(spy2);
  });
});

describe("destroyReaction", () => {
  it("destroys registered computations", () => {
    const spy = vi.fn();
    const reaction1 = createReaction(spy);
    const reaction2 = createReaction(spy);

    destroyReaction(reaction1);
    destroyReaction(reaction2);

    expect(getComputation(reaction1)).toBeUndefined();
    expect(getComputation(reaction2)).toBeUndefined();
  });
});
