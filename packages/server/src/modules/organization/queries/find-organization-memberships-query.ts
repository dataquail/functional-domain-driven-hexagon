import type * as DateTime from "effect/DateTime";
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { type UsersLookup } from "@/modules/organization/domain/ports/external/users-lookup.js";
import { type MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership-repository.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Detailed membership view returned to the SA admin "list members"
// surface. The handler orchestrates two reads — `MembershipRepository`
// for the membership rows, then the `UsersLookup` outbound port for
// each user's email — because ADR-0021 disallows cross-schema SQL.
// The endpoint just dispatches through the QueryBus and maps the
// result to the contract; the cross-module concerns stay inside the
// use case (matching the "outbound ports are private to use cases"
// rule).
export const FindOrganizationMembershipsQuery = Schema.TaggedStruct(
  "FindOrganizationMembershipsQuery",
  { organizationId: OrganizationId },
);
export type FindOrganizationMembershipsQuery = typeof FindOrganizationMembershipsQuery.Type;

export const findOrganizationMembershipsQuerySpanAttributes: SpanAttributesExtractor<
  FindOrganizationMembershipsQuery
> = (query) => ({ "organization.id": query.organizationId });

export type OrganizationMemberView = {
  readonly userId: UserId;
  readonly email: string;
  readonly joinedAt: DateTime.Utc;
};

export type FindOrganizationMembershipsOutput = Effect.Effect<
  ReadonlyArray<OrganizationMemberView>,
  PersistenceUnavailable,
  MembershipRepository | UsersLookup
>;
