import * as Schema from "effect/Schema";

/**
 * Domain-language signal that the store backing a repository is momentarily
 * unable to service the request — connection lost, backend terminated,
 * transient outage. The right reaction at a transport boundary is a 503; the
 * right reaction in a use case is to propagate.
 *
 * It lives here rather than in a host's database package so a module's `domain/`
 * can name it in a repository port without importing infrastructure. The host's
 * adapter translates its own transient signal into this at the boundary.
 *
 * Distinct from a constraint violation, which is permanent: the repository
 * either translates it into a domain error or lets it die as a defect. This is
 * the transient-retry case.
 */
export class PersistenceUnavailable extends Schema.TaggedErrorClass<PersistenceUnavailable>()(
  "PersistenceUnavailable",
  { message: Schema.String },
) {}
