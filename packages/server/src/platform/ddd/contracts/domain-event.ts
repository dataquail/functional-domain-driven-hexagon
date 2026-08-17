// The event vocabulary `domain/` is allowed to name, under this application's
// own words rather than the library's.
//
// It exists mostly for the boundary, not the rename. Without it `domain-isolation`
// has to allowlist `@effect-server-utils/cqrs`'s internal file paths, which couples an enforcement
// rule to another package's file layout — and because that package generates its
// published surface from every top-level file, renaming one there would silently
// change what the domain may import. Pointing the domain at this folder instead
// makes "which of the library is domain-safe?" a file a reviewer can read whole.
//
// Re-exported wholesale because this module *is* domain-safe in its entirety: the
// bus and the unit of work are separate modules, and admitting them is what the
// tiering exists to prevent.
export * from "@effect-server-utils/cqrs/event";

/** `Event.Base` under the name the aggregates use for it. */
export type { Base as DomainEvent } from "@effect-server-utils/cqrs/event";
