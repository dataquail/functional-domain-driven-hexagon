import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

// Pipeline step for live repositories: translates the `@org/database`
// transient signal into the domain-language port-level signal. Apply at
// the end of every live repo method's pipe so the inferred error channel
// matches the port shape — domain ports can't import `@org/database`
// (dep-cruiser `domain-isolation`), so live repos must do the swap
// before the channel crosses the port boundary.
//
// Mirrors the `recoverPersistenceUnavailable` helper at the HTTP layer:
// one translation at each architectural seam keeps each layer expressed
// in its own vocabulary.
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
    (e: Database.DatabaseUnavailable) =>
      Effect.fail(new PersistenceUnavailable({ message: e.message })),
  ) as Effect.Effect<A, Exclude<E, Database.DatabaseUnavailable> | PersistenceUnavailable, R>;
