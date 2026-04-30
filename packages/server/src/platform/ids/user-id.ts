import * as Schema from "effect/Schema";

// Canonical server-internal UserId used by every module that needs to
// reference a user by id (wallet's user_id FK, todos' currentUser, etc.).
// Lives in the platform shared kernel — narrowly allowlisted by the four
// layer-isolation dep-cruiser rules — so modules don't end up redeclaring
// the brand and drifting. See ADR-0002 ("typed-ID shared kernel" addendum).
//
// Scope is intentionally narrow: this folder is for branded entity IDs
// only — no value objects, no enums, no aggregate types. Vernon's "shared
// kernel keeps growing" warning is real; the constraint here is the rule.
export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;
