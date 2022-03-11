export type ReactionId = number;
export type Computation = () => void;

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

export function getComputation(
  reactionId: ReactionId
): Computation | undefined {
  return reactionsRegistry[reactionId];
}
