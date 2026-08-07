import { PersistenceUnavailable } from "@org/cqrs";
import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

// Pipeline step for the persistence boundary: folds both `@org/database`
// signals into the port's vocabulary in one step. Permanent failures
// (`DatabaseError`) become defects — a constraint violation that reached here
// is a repo that missed a case; transient ones (`DatabaseUnavailable`) become
// the port-level `PersistenceUnavailable` a use case can propagate.
//
// Domain ports can't import `@org/database` (dep-cruiser `domain-isolation`),
// so the swap has to happen before the channel crosses the port boundary.
//
// Mirrors `recoverPersistenceUnavailable` at the HTTP layer: one translation at
// each architectural seam keeps each layer expressed in its own vocabulary.
//
// `catchTag` on a generic union channel resists inference cleanly, so the
// implementation catches on the widened type then re-asserts the narrowed
// result. The casts are contained here so callers stay clean.
export const translateDatabaseErrors: <A, E, R>(
  effect: Effect.Effect<A, E | Database.DatabaseError | Database.DatabaseUnavailable, R>,
) => Effect.Effect<
  A,
  Exclude<E, Database.DatabaseError | Database.DatabaseUnavailable> | PersistenceUnavailable,
  R
> = <A, E, R>(
  effect: Effect.Effect<A, E | Database.DatabaseError | Database.DatabaseUnavailable, R>,
) =>
  Effect.catchTags(
    effect as Effect.Effect<A, Database.DatabaseError | Database.DatabaseUnavailable, R>,
    {
      DatabaseError: Effect.die,
      DatabaseUnavailable: (e: Database.DatabaseUnavailable) =>
        new PersistenceUnavailable({ message: e.message }),
    },
  ) as Effect.Effect<
    A,
    Exclude<E, Database.DatabaseError | Database.DatabaseUnavailable> | PersistenceUnavailable,
    R
  >;

// The transient half alone, for the repositories that translate
// `DatabaseError` themselves (a `unique_violation` that carries a real domain
// meaning, e.g. `UserAlreadyExists`) and so must not have it demoted to a
// defect underneath them.
export const translatePersistenceUnavailable: <A, E, R>(
  effect: Effect.Effect<A, E | Database.DatabaseUnavailable, R>,
) => Effect.Effect<A, Exclude<E, Database.DatabaseUnavailable> | PersistenceUnavailable, R> = <
  A,
  E,
  R,
>(
  effect: Effect.Effect<A, E | Database.DatabaseUnavailable, R>,
) =>
  Effect.catchTag(
    effect as Effect.Effect<A, Database.DatabaseUnavailable, R>,
    "DatabaseUnavailable",
    (e: Database.DatabaseUnavailable) => new PersistenceUnavailable({ message: e.message }),
  ) as Effect.Effect<A, Exclude<E, Database.DatabaseUnavailable> | PersistenceUnavailable, R>;
