import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import type * as Command from "./command.js";
import type * as Event from "./event.js";
import * as Serializable from "./internal/serializable.js";
import type * as Query from "./query.js";

/**
 * Checks a host would run in its own test suite, kept out of the package's main
 * surface on purpose.
 *
 * The checker derives sample values with `fast-check`, which is a real runtime
 * import. Reached through the barrel it would ride into every consumer's
 * production process for a check that only ever runs in a test, so it lives
 * behind its own entry point — `@org/cqrs/testing` — and nothing in the main
 * import graph names it.
 */

export type { Incompatibility } from "./internal/serializable.js";

/**
 * Reports any channel of any message in the group that cannot survive a
 * round-trip through JSON. Empty means every declared contract is portable.
 *
 * In-process dispatch never encodes anything, so this is the only thing standing
 * between "these are schemas, so a module could be extracted" and a payload that
 * quietly cannot travel. Call it from a test, over every group the host declares.
 *
 * A checker rather than an assertion: it reports what it found so a caller can
 * present every problem at once, instead of stopping at the first.
 */
export const checkSerializable = (
  group: Command.AnyGroup | Query.AnyGroup,
): Effect.Effect<ReadonlyArray<Serializable.Incompatibility>> => Serializable.check(group.messages);

/**
 * The same check for events, which have no group to be collected into.
 *
 * Events are the messages most likely to be persisted or replayed later — an
 * outbox row, a durable log — so an event that cannot be encoded is the most
 * expensive kind to discover late.
 */
export const checkEventsSerializable = (
  events: ReadonlyArray<Event.Any>,
): Effect.Effect<ReadonlyArray<Serializable.Incompatibility>> =>
  Serializable.check(
    events.map((event) => ({
      tag: event.tag,
      schemas: { payload: event, success: Schema.Void, failure: Schema.Never },
    })) as never,
  );
