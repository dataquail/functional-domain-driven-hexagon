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

export const dehydrateQuery = <A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  value: A,
): Hydration.DehydratedAtom => {
  if (!Atom.isSerializable(atom)) {
    throw new NotSerializableError(String(atom.label ?? "<unlabelled>"));
  }
  const serializable = atom[Atom.SerializableTypeId];
  return {
    "~effect/reactivity/DehydratedAtom": true,
    key: serializable.key,
    value: serializable.encode(AsyncResult.success(value)),
    dehydratedAt: Date.now(),
  } satisfies Hydration.DehydratedAtomValue as Hydration.DehydratedAtom;
};
