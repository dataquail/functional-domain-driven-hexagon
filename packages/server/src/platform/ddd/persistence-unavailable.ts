import * as Schema from "effect/Schema";

// Domain-language signal that the persistence backing a repository is
// momentarily unable to service the request — connection lost, backend
// terminated, transient outage. The right reaction at the HTTP layer is
// a 503; the right reaction in the use case is to propagate.
//
// This lives in the DDD shared kernel rather than in `@org/database` so
// every module's `domain/` can express it in its repository ports
// without importing an infrastructure package (which the dependency
// rules forbid). The live repository translates infrastructure-specific
// errors (e.g. `Database.DatabaseUnavailable` for the Slonik/Postgres
// adapter) into this abstract port-level error at the boundary.
//
// Distinct from any constraint-violation `DatabaseError`: constraint
// errors are permanent and either translated to a domain error by the
// repository (e.g. unique violation → `UserAlreadyExists`) or die as
// programmer-error defects. `PersistenceUnavailable` is the
// transient-retry case.
export class PersistenceUnavailable extends Schema.TaggedError<PersistenceUnavailable>(
  "PersistenceUnavailable",
)("PersistenceUnavailable", {
  message: Schema.String,
}) {}
