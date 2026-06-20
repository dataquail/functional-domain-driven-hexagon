import * as Effect from "effect/Effect";

import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

// Use-case-facing boundary combinator: declare the unit of work once, at
// the end of a command handler's pipe, the way Cosmic-Python writes
// `with uow:` at the top of a handler. The transaction is then visible and
// local — not buried in bus registration, and not an inner `uow.run(...)`
// block that synchronously-dispatched event handlers participate in
// *without* wrapping (the asymmetry that made the inner-callback shape feel
// wrong).
//
// Named `withUnitOfWork`, deliberately not `transactional`: "transactional"
// leaks the SQL-transaction implementation the UoW abstraction exists to
// hide. The error channel is kept as abstraction-clean as the name — it
// surfaces the domain-language `PersistenceUnavailable` (transient store
// outage → 503 at the HTTP layer) and never `Database.DatabaseError`
// (constraint violations, which are programmer-error defects once the
// repository has had its chance to translate them to a domain error). This
// combinator demotes `DatabaseError` to a defect in one place, replacing the
// per-handler `.pipe(Effect.catchTag("DatabaseError", Effect.die))` that was
// duplicated across every command handler.
//
// `UnitOfWork.run` remains the low-level primitive (the escape hatch, and
// what integration tests drive directly); `withUnitOfWork` is the API use
// cases reach for.
//
// The return type is inferred: `UnitOfWork.run` adds `DatabaseError` and
// `PersistenceUnavailable` to the channel, and `catchTag("DatabaseError", …)`
// removes the former — leaving `Exclude<E, DatabaseError> | PersistenceUnavailable`
// with `Database.TransactionContext` provided away and `UnitOfWork` reintroduced
// into `R`. Call sites pin the concrete shape via their declared bus-output types.
export const withUnitOfWork = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(UnitOfWork, (uow) => uow.run(effect)).pipe(
    Effect.catchTag("DatabaseError", (e) => Effect.die(e)),
  );
