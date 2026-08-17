// The transient-store signal every repository port's error channel includes.
//
// The name is unchanged, so this re-export buys no vocabulary — it buys the
// boundary. See `domain-event.ts` for why the domain reaches this folder rather
// than reaching into the library by path.
export { PersistenceUnavailable } from "@effect-server-utils/cqrs/persistence-unavailable";
