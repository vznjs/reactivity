import { describe, it, expect } from "vitest";
import { createAtom } from "../../src/core/atom";

describe("createAtom", () => {
  it("creates atom id incrementally", () => {
    const atom1 = createAtom();
    const atom2 = createAtom();

    expect(atom1).toBeGreaterThan(0);
    expect(atom2).toBe(atom1 + 1);
  });
});
