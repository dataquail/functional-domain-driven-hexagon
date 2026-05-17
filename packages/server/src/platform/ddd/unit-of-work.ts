import { type Database } from "@org/database/index";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

// Port for "run this effect inside a single unit of work."
//
// In DDD terms, a unit of work is the atomicity boundary for a logical
// operation: every repository write inside it commits together or rolls
// back together, and every synchronously-dispatched domain event handler
// inherits that same boundary (ADR-0007). Use cases depend on this port —
// not on `Database` — so they can be unit-tested against `IdentityUnitOfWork`
// without touching SQL.
//
// The production binding (`UnitOfWorkLive` in `platform/unit-of-work-live.ts`)
// is the one place that knows the boundary is implemented as a SQL
// transaction. The `Exclude<R, Database.TransactionContext>` in the return
// type is what makes that fact land at the type level: callers can compose
// effects that *require* `TransactionContext`, and `run` is the seam that
// provides it.
export interface UnitOfWorkShape {
  readonly run: <A, E, R>(
    effect: Effect.Effect<A, E, R>,
  ) => Effect.Effect<A, E | Database.DatabaseError, Exclude<R, Database.TransactionContext>>;
}

export class UnitOfWork extends Context.Tag("UnitOfWork")<UnitOfWork, UnitOfWorkShape>() {}
