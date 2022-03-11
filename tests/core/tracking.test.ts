import { describe, it, vi, expect } from "vitest";
import { createAtom } from "../../src/core/atom";
import { createReaction } from "../../src/core/reaction";
import { track, getAtoms, getReactions } from "../../src/core/tracking";

describe("track", () => {
  it("tracks new atom and new reaction", async () => {
    const atom1 = createAtom();
    const reaction1 = createReaction(vi.fn());

    expect(getReactions(atom1)).toBeUndefined();
    expect(getAtoms(reaction1)).toBeUndefined();

    track(atom1, reaction1);

    expect(getReactions(atom1)).toEqual([reaction1]);
    expect(getAtoms(reaction1)).toEqual([atom1]);
  });

  it("tracks new atom and used reaction", () => {
    const atom1 = createAtom();
    const atom2 = createAtom();
    const reaction1 = createReaction(vi.fn());

    expect(getReactions(atom1)).toBeUndefined();
    expect(getAtoms(reaction1)).toBeUndefined();

    track(atom2, reaction1);
    track(atom1, reaction1);

    expect(getReactions(atom1)).toEqual([reaction1]);
    expect(getAtoms(reaction1)).toEqual([atom2, atom1]);
  });

  it("tracks new atom and tracked reaction", () => {
    const atom1 = createAtom();
    const reaction1 = createReaction(vi.fn());

    expect(getReactions(atom1)).toBeUndefined();
    expect(getAtoms(reaction1)).toBeUndefined();

    track(atom1, reaction1);
    track(atom1, reaction1);

    expect(getReactions(atom1)).toEqual([reaction1]);
    expect(getAtoms(reaction1)).toEqual([atom1]);
  });

  it("tracks used atom and new reaction", () => {
    const atom1 = createAtom();
    const reaction1 = createReaction(vi.fn());
    const reaction2 = createReaction(vi.fn());

    expect(getReactions(atom1)).toBeUndefined();
    expect(getAtoms(reaction1)).toBeUndefined();

    track(atom1, reaction2);
    track(atom1, reaction1);

    expect(getReactions(atom1)).toEqual([reaction2, reaction1]);
    expect(getAtoms(reaction1)).toEqual([atom1]);
  });

  it("tracks used atom and used reaction", () => {
    const atom1 = createAtom();
    const atom2 = createAtom();
    const reaction1 = createReaction(vi.fn());
    const reaction2 = createReaction(vi.fn());

    expect(getReactions(atom1)).toBeUndefined();
    expect(getAtoms(reaction1)).toBeUndefined();

    track(atom1, reaction2);
    track(atom2, reaction1);
    track(atom1, reaction1);

    expect(getReactions(atom1)).toEqual([reaction2, reaction1]);
    expect(getAtoms(reaction1)).toEqual([atom2, atom1]);
  });

  it("tracks used atom and tracked reaction", () => {
    const atom1 = createAtom();
    const reaction1 = createReaction(vi.fn());
    const reaction2 = createReaction(vi.fn());

    expect(getReactions(atom1)).toBeUndefined();
    expect(getAtoms(reaction1)).toBeUndefined();

    track(atom1, reaction2);
    track(atom1, reaction1);
    track(atom1, reaction1);

    expect(getReactions(atom1)).toEqual([reaction2, reaction1]);
    expect(getAtoms(reaction1)).toEqual([atom1]);
  });
});
