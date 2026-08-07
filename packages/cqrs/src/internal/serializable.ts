import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as FastCheck from "effect/testing/FastCheck";

import type * as Message from "./message.js";

/** One channel of one message that cannot survive a round-trip through JSON. */
export interface Incompatibility {
  readonly tag: string;
  readonly channel: "payload" | "success" | "failure";
  readonly reason: string;
}

/**
 * Nothing crosses a boundary for these, so there is nothing to check: a message
 * that declares no payload sends none, and one that cannot fail carries no error.
 * Their encoded form is absent rather than JSON, so asking them to round-trip
 * would report a problem that does not exist.
 */
const carriesNothing = (schema: Schema.Top): boolean => {
  const tag = (schema.ast as { readonly _tag?: string } | undefined)?._tag;
  return tag === "Void" || tag === "Never" || tag === "Undefined";
};

const SAMPLES = 20;

/**
 * Checks that a message's declared channels can be represented as JSON and read
 * back — the promise that declaring them as schemas rather than as bare types is
 * paid for.
 *
 * In-process dispatch passes values by reference and never encodes anything, so
 * that promise is otherwise untested: a payload carrying a class instance, an
 * `Option`, a `Map`, or a branded type with an opaque refinement works perfectly
 * today and is silently unable to travel. This is what turns the claim into
 * something that fails a build.
 *
 * Property-based rather than sample-based, because the interesting failures live
 * in the fields a hand-written fixture omits — the nullable one, the nested union,
 * the empty array.
 *
 * A checker rather than an assertion: it reports what it found so a caller can
 * present every problem at once, instead of stopping at the first.
 */
export const check = (
  messages: ReadonlyArray<Message.Any<string>>,
): Effect.Effect<ReadonlyArray<Incompatibility>> =>
  Effect.gen(function* () {
    const found: Array<Incompatibility> = [];

    for (const message of messages) {
      for (const channel of ["payload", "success", "failure"] as const) {
        const schema = message.schemas[channel];
        if (carriesNothing(schema)) continue;

        const reason = yield* checkChannel(schema);
        if (reason !== undefined) found.push({ tag: message.tag, channel, reason });
      }
    }

    return found;
  });

const checkChannel = (schema: Schema.Top): Effect.Effect<string | undefined> =>
  Effect.gen(function* () {
    // Deriving the generator is itself a check: a schema whose values cannot be
    // constructed generically — a class behind `instanceOf`, a custom declaration —
    // throws here, and that is exactly the shape that cannot be serialized either.
    // Kept out of the error channel: an unusable schema is a finding to report, not
    // a failure of the checker.
    const generated = yield* Effect.sync(() => {
      try {
        return { samples: FastCheck.sample(Schema.toArbitrary(schema), SAMPLES) };
      } catch (cause) {
        return { reason: `no generator could be derived: ${String(cause)}` };
      }
    });

    if (generated.samples === undefined) return generated.reason;

    const codec = Schema.toCodecJson(schema);
    // A schema that needed services to encode could not be a wire contract in the
    // first place, so the checker treats them as absent. If one ever did, the
    // missing service surfaces as a defect here — still a failure the author must
    // fix, which is the outcome either way.
    type Codec = (input: unknown) => Effect.Effect<unknown, unknown>;
    const encode = Schema.encodeUnknownEffect(codec) as Codec;
    const decode = Schema.decodeUnknownEffect(codec) as Codec;

    for (const sample of generated.samples) {
      const encoded = yield* Effect.result(encode(sample));
      if (Result.isFailure(encoded)) {
        return `cannot be encoded to JSON: ${String(encoded.failure)}`;
      }

      const decoded = yield* Effect.result(decode(encoded.success));
      if (Result.isFailure(decoded)) {
        return `encodes to JSON but cannot be read back: ${String(decoded.failure)}`;
      }

      // Re-encoding the decoded value compares like with like, which sidesteps
      // needing structural equality over decoded domain types. An asymmetric
      // codec shows up here as two different encodings of the same value.
      const reEncoded = yield* Effect.result(encode(decoded.success));
      if (Result.isFailure(reEncoded)) {
        return `round-trips once but not twice: ${String(reEncoded.failure)}`;
      }
      if (JSON.stringify(reEncoded.success) !== JSON.stringify(encoded.success)) {
        return `does not round-trip: ${JSON.stringify(encoded.success)} became ${JSON.stringify(reEncoded.success)}`;
      }
    }

    return undefined;
  });
