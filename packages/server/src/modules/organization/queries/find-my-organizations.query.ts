import { type Database } from "@org/database/index";
import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Lists the organizations the caller is a member of. Used by the
// frontend to resolve "which org am I working in" without needing to
// pass an orgId on every URL until the route reshape lands.
//
// Tombstoned orgs are filtered out — a soft-deleted org should not
// appear in the caller's chooser.
export const FindMyOrganizationsQuery = Schema.TaggedStruct("FindMyOrganizationsQuery", {
  userId: UserId,
});
export type FindMyOrganizationsQuery = typeof FindMyOrganizationsQuery.Type;

export const findMyOrganizationsQuerySpanAttributes: SpanAttributesExtractor<
  FindMyOrganizationsQuery
> = (query) => ({
  "query.userId": query.userId,
});

export type FindMyOrganizationsView = {
  readonly id: OrganizationId;
  readonly name: string;
  readonly createdAt: DateTime.Utc;
  readonly updatedAt: DateTime.Utc;
  // Whether the caller holds the `admin` OrganizationRole in this org.
  // Drives the frontend's admin-only surfaces (Billing / Invite tabs,
  // member management) without a separate role probe.
  readonly isAdmin: boolean;
};

export type FindMyOrganizationsResult = {
  readonly organizations: ReadonlyArray<FindMyOrganizationsView>;
};

export type FindMyOrganizationsOutput = Effect.Effect<
  FindMyOrganizationsResult,
  PersistenceUnavailable,
  Database.Database
>;

declare module "@/platform/ddd/ports/query-bus.js" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires `interface`
  interface QueryRegistry {
    FindMyOrganizationsQuery: {
      readonly query: FindMyOrganizationsQuery;
      readonly output: FindMyOrganizationsOutput;
    };
  }
}
