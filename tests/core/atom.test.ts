import { describe, it, expect } from "vitest";
import { createAtom } from "../../src/core/atom";

describe("createAtom", () => {
  it("creates atom id", () => {
    const atom1 = createAtom();
    const atom2 = createAtom();

    expect(atom1).toBe(1);
    expect(atom2).toBe(2);
  });
});
