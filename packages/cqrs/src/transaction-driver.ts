import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import type { PersistenceUnavailable } from "./persistence-unavailable.js";

/**
 * The unit of work's atomicity machinery failed — a commit was rejected, a
 * savepoint could not be released. Distinct from the errors a repository raises
 * and handles below the boundary: by the time an effect reaches the unit of
 * work, a repository has already translated its own constraint violations into
 * domain errors. What is left is the boundary itself failing, which no use case
 * can act on, so `withUnitOfWork` demotes it to a defect.
 */
export class TransactionFailed extends Schema.TaggedErrorClass<TransactionFailed>(
  "TransactionFailed",
)("TransactionFailed", {
  message: Schema.String,
}) {}

/**
 * The atomicity primitive a host supplies. This is the whole of what the unit
 * of work needs from a datastore, and the reason the unit of work itself can
 * live in this package: the semantics — nesting, post-commit buffering, flush
 * ordering, failure isolation — are here, while the SQL is the host's.
 *
 * An adapter is responsible for making its own scope handle ambient to the
 * effect it wraps, so a repository inside picks it up. Nothing about that handle
 * appears here; if it did, every consumer's read path would have to name it.
 */
export interface TransactionDriverShape {
  /** Opens a top-level scope. Committing on success, discarding on failure. */
  readonly withTransaction: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | TransactionFailed | PersistenceUnavailable, R>;
  /**
   * Opens a nested scope on the ambient one. A failure caught by the caller
   * discards only this scope, leaving the enclosing one free to commit — the
   * property that lets a nested unit of work be recoverable.
   */
  readonly withSavepoint: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | TransactionFailed | PersistenceUnavailable, R>;
  /** Whether a scope is already open, which is what makes `run` re-entrant. */
  readonly isActive: Effect.Effect<boolean>;
}

export class TransactionDriver extends Context.Service<TransactionDriver, TransactionDriverShape>()(
  "@org/cqrs/TransactionDriver",
) {}
