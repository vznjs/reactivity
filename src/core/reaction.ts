export type ReactionId = number;

export interface ReactionContext {
  compute: Computation;
}

export type Computation<T extends ReactionContext = any> = (
  this: T,
  reactionId: ReactionId
) => void;

let ID: ReactionId = 0;

const reactionsRegistry: { [key: ReactionId]: ReactionContext | undefined } =
  {};

export function createReaction<T extends ReactionContext>(
  context: T
): ReactionId {
  const id = ++ID;
  reactionsRegistry[id] = context;
  return id;
}

export function destroyReaction(reactionId: ReactionId): void {
  delete reactionsRegistry[reactionId];
}

export function runReaction(reactionId: ReactionId): void {
  const context = reactionsRegistry[reactionId];
  context?.compute.call(context, reactionId);
}
