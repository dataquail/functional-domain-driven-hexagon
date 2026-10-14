import { PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

const isDatabaseError = Schema.is(Database.DatabaseError);

const isDatabaseUnavailable = Schema.is(Database.DatabaseUnavailable);

const toPersistenceUnavailable = (error: Database.DatabaseUnavailable) =>
  Effect.fail(new PersistenceUnavailable({ message: error.message }));

const isDatabaseFailure = (
  error: unknown,
): error is Database.DatabaseError | Database.DatabaseUnavailable =>
  isDatabaseError(error) || isDatabaseUnavailable(error);

const translateFailure = (
  error: Database.DatabaseError | Database.DatabaseUnavailable,
): Effect.Effect<never, PersistenceUnavailable> => {
  if (isDatabaseError(error)) return Effect.die(error);

  return toPersistenceUnavailable(error);
};

// The transient half alone, for the repositories that translate
// `DatabaseError` themselves (a `unique_violation` that carries a real domain
// meaning, e.g. `UserAlreadyExists`) and so must not have it demoted to a
// defect underneath them.
export const translatePersistenceUnavailable = <A, E, R>(
  effect: Effect.Effect<A, E | Database.DatabaseUnavailable, R>,
): Effect.Effect<A, Exclude<E, Database.DatabaseUnavailable> | PersistenceUnavailable, R> =>
  Effect.catchIf<
    A,
    E | Database.DatabaseUnavailable,
    R,
    Database.DatabaseUnavailable,
    never,
    PersistenceUnavailable,
    never
  >(effect, isDatabaseUnavailable, toPersistenceUnavailable);

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
export const translateDatabaseErrors = <A, E, R>(
  effect: Effect.Effect<A, E | Database.DatabaseError | Database.DatabaseUnavailable, R>,
): Effect.Effect<
  A,
  Exclude<E, Database.DatabaseError | Database.DatabaseUnavailable> | PersistenceUnavailable,
  R
> =>
  Effect.catchIf<
    A,
    E | Database.DatabaseError | Database.DatabaseUnavailable,
    R,
    Database.DatabaseError | Database.DatabaseUnavailable,
    never,
    PersistenceUnavailable,
    never
  >(effect, isDatabaseFailure, translateFailure);
