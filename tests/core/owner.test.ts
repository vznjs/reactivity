import { describe, expect, it } from "vitest";
import { createOwner, getOwner, runWithOwner } from "../../src";

describe("owner", () => {
  it("creates owner", () => {
    const owner = createOwner({
      disposerId: 1,
      reactionId: 2,
    });

    expect(owner).toStrictEqual({ disposerId: 1, reactionId: 2, parent: {} });
  });

  it("creates owner with parent", () => {
    expect(getOwner()).toStrictEqual({});

    const parent = createOwner({
      disposerId: 1,
      reactionId: 2,
    });

    runWithOwner(parent, () => {
      expect(getOwner()).toStrictEqual(parent);

      const child = createOwner({
        disposerId: 3,
      });

      expect(child).toStrictEqual({
        disposerId: 3,
        reactionId: 2,
        parent,
      });
    });
  });
});
