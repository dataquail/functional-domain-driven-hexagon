import * as Option from "effect/Option";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Hydration from "effect/reactivity/Hydration";

const isNew =
  (registry: AtomRegistry.AtomRegistry) =>
  (entry: Hydration.DehydratedAtomValue): boolean =>
    !registry.getNodes().has(entry.key);

// Hydrating a key that has no node is a preload its first reader picks up, so it
// is safe before anything renders.
export const hydrateNew = (
  registry: AtomRegistry.AtomRegistry,
  state: Iterable<Hydration.DehydratedAtom>,
): ReadonlyArray<Hydration.DehydratedAtom> => {
  const entries = Hydration.toValues(Array.from(state));
  Hydration.hydrate(registry, entries.filter(isNew(registry)));

  return entries.filter((entry) => !isNew(registry)(entry));
};

// A live node only takes a preloaded value when it is next looked up, so each one
// is read once to hand its subscribers the new value.
export const hydrateExisting = (
  registry: AtomRegistry.AtomRegistry,
  existing: ReadonlyArray<Hydration.DehydratedAtom>,
): void => {
  Hydration.hydrate(registry, existing);

  for (const entry of Hydration.toValues(existing)) {
    const node = Option.fromUndefinedOr(registry.getNodes().get(entry.key));

    if (Option.isSome(node)) registry.get(node.value.atom);
  }
};
