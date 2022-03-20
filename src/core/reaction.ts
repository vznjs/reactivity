export type ReactionId = number;
export type Computation = (reactionId: ReactionId) => void;

let ID: ReactionId = 0;

const reactionsRegistry: { [key: ReactionId]: Computation | undefined } = {};

export function createReaction(compute: Computation): ReactionId {
  const reactionId = ++ID;
  reactionsRegistry[reactionId] = compute;
  return reactionId;
}

export function destroyReaction(reactionId: ReactionId): void {
  delete reactionsRegistry[reactionId];
}

export function runReaction(reactionId: ReactionId): void {
  reactionsRegistry[reactionId]?.(reactionId);
}
