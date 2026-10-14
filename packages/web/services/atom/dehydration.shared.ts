// Turns a server-fetched value into the dehydrated entry a client registry
// preloads, without ever mounting the atom.
//
// Mounting is the thing to avoid: it would build the atom runtime's layer, and
// `Atom.defaultMemoMap` keys builds by layer identity in a Map that is never
// evicted -- a per-request server layer would therefore leak one entry per
// request. Reading the atom's own serialization metadata instead is pure, so
// the server keeps its plain `HttpApiClient` transport and no runtime is ever
// built outside the browser.

import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import type * as Hydration from "effect/reactivity/Hydration";
import * as Schema from "effect/Schema";

export class NotSerializableError extends Schema.TaggedError<
  NotSerializableError,
  { readonly brand: "NotSerializableError" }
>()("NotSerializableError", { label: Schema.String }) {
  override get message(): string {
    return `Atom ${this.label} carries no serialization metadata. A query is only hydratable if it was declared with a \`serializationKey\`.`;
  }
}

type SerializationMetadata = Atom.Serializable<Schema.Top>[Atom.SerializableTypeId];

// A query declaring `reactivityKeys` is handed back wrapped: `AtomHttpApi`
// applies `withReactivity`, which is a `transform`, and a transform builds a new
// atom rather than copying the serialization metadata off the one it wraps. The
// wrapper does carry `initialValueTarget` pointing at the atom underneath -- the
// same link hydration uses to seed through a wrapper -- so the metadata is one
// hop away rather than gone. Every query in this app declares both keys, so this
// unwrapping is the normal path, not an edge case.
const serializationOf = <A>(atom: Atom.Atom<A>): Option.Option<SerializationMetadata> => {
  if (Atom.isSerializable(atom)) return Option.some(atom[Atom.SerializableTypeId]);

  return Option.flatMap(Option.fromUndefinedOr(atom.initialValueTarget), serializationOf);
};

export const dehydrateQuery = <A, E>(
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  value: A,
): Effect.Effect<Hydration.DehydratedAtom, NotSerializableError> =>
  Effect.gen(function* () {
    const serializable = yield* Effect.fromOption(serializationOf(atom)).pipe(
      Effect.mapError(
        () => new NotSerializableError({ label: String(atom.label ?? "<unlabelled>") }),
      ),
    );

    // The Hydration contract takes epoch millis, not a DateTime.
    const dehydratedAt = yield* Clock.currentTimeMillis;

    const entry: Hydration.DehydratedAtomValue = {
      "~effect/reactivity/Hydration/DehydratedAtom": true,
      key: serializable.key,
      value: serializable.encode(AsyncResult.success(value)),
      dehydratedAt,
    };

    return entry;
  });
