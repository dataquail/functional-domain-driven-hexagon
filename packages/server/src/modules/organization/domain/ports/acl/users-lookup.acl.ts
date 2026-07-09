import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type UserId } from "@/platform/ids/user-id.js";

// ADR-0023 outbound port. The org module needs to enrich its
// membership rows with each user's email for the SA admin "list
// members" surface, but ADR-0021 forbids cross-schema SQL. This port
// generalizes the cross-module read so the org-module consumer
// doesn't know about the user module's query vocabulary; only the
// Live adapter in `infrastructure/acl/` does. The Live captures
// `Database` (the transitive dep of the bus-dispatched user-module
// query) at construction time so the port's method surface stays
// `R = never`.
export type UserLookupView = {
  readonly userId: UserId;
  readonly email: string;
};

export type UsersLookupShape = {
  readonly findByIds: (
    ids: ReadonlyArray<UserId>,
  ) => Effect.Effect<ReadonlyArray<UserLookupView>, PersistenceUnavailable>;
};

export class UsersLookup extends Context.Service<UsersLookup, UsersLookupShape>()(
  "@org/server/organization/UsersLookup",
) {}
