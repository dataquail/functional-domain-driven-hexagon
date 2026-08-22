// Turns a server-fetched value into the dehydrated entry a client registry
// preloads, without ever mounting the atom.
//
// Mounting is the thing to avoid: it would build the atom runtime's layer, and
// `Atom.defaultMemoMap` keys builds by layer identity in a Map that is never
// evicted -- a per-request server layer would therefore leak one entry per
// request. Reading the atom's own serialization metadata instead is pure, so
// the server keeps its plain `HttpApiClient` transport and no runtime is ever
// built outside the browser.

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import type * as Hydration from "effect/unstable/reactivity/Hydration";

export class NotSerializableError extends Error {
  constructor(label: string) {
    super(
      `Atom ${label} carries no serialization metadata. A query is only hydratable if it was declared with a \`serializationKey\`.`,
    );
    this.name = "NotSerializableError";
  }
}

// A query declaring `reactivityKeys` is handed back wrapped: `AtomHttpApi`
// applies `withReactivity`, which is a `transform`, and a transform builds a new
// atom rather than copying the serialization metadata off the one it wraps. The
// wrapper does carry `initialValueTarget` pointing at the atom underneath -- the
// same link hydration uses to seed through a wrapper -- so the metadata is one
// hop away rather than gone. Every query in this app declares both keys, so this
// unwrapping is the normal path, not an edge case.
const serializationOf = (atom: Atom.Atom<unknown>) => {
  let target: Atom.Atom<unknown> | undefined = atom;
  while (target !== undefined) {
    if (Atom.isSerializable(target)) return target[Atom.SerializableTypeId];
    target = target.initialValueTarget;
  }
  return undefined;
};

export const dehydrateQuery = <A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  value: A,
): Hydration.DehydratedAtom => {
  const serializable = serializationOf(atom);
  if (serializable === undefined) {
    throw new NotSerializableError(String(atom.label ?? "<unlabelled>"));
  }
  return {
    "~effect/reactivity/DehydratedAtom": true,
    key: serializable.key,
    value: serializable.encode(AsyncResult.success(value)),
    dehydratedAt: Date.now(),
  } satisfies Hydration.DehydratedAtomValue as Hydration.DehydratedAtom;
};
