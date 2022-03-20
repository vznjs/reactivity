import { describe, it, expect, vi } from "vitest";
import {
  createReaction,
  runReaction,
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

describe("runReaction", () => {
  it("returns registered computations", () => {
    const spy = vi.fn();
    const reaction1 = createReaction(spy);

    runReaction(reaction1);
    expect(spy.mock.calls.length).toBe(1);
  });
});

describe("destroyReaction", () => {
  it("destroys registered computations", () => {
    const spy = vi.fn();
    const reaction1 = createReaction(spy);

    destroyReaction(reaction1);

    runReaction(reaction1);
    expect(spy.mock.calls.length).toBe(0);
  });
});
