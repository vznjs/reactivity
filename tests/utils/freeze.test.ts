import { describe, it, vi, expect } from "vitest";
import {
  createReaction,
  getOwner,
  runWithOwner,
  createOwner,
  freeze,
  createDisposer,
  onCleanup,
  flushDisposer,
} from "../../src";

describe("freeze", () => {
  it("runs without any reaction", () => {
    const reactionId = createReaction({
      compute: () => {
        // dummy
      },
    });

    expect(getOwner().reactionId).toBeUndefined();

    runWithOwner(createOwner({ disposerId: undefined, reactionId }), () => {
      expect(getOwner().reactionId).toBe(reactionId);

      freeze(() => {
        expect(getOwner().reactionId).toBeUndefined();
      });

      expect(getOwner().reactionId).toBe(reactionId);
    });

    expect(getOwner().reactionId).toBeUndefined();
  });

  it("runs cleanups in reaction correctly", () => {
    const disposerId = createDisposer();
    const cleanupMock = vi.fn();

    expect(getOwner().disposerId).toBeUndefined();

    runWithOwner(createOwner({ disposerId, reactionId: undefined }), () => {
      freeze(() => {
        onCleanup(cleanupMock);
      });
    });

    expect(cleanupMock.mock.calls.length).toBe(0);

    flushDisposer(disposerId);

    expect(cleanupMock.mock.calls.length).toBe(1);
  });
});
