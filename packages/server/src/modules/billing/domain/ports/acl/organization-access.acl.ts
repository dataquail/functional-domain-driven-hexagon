import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";
import { type UserId } from "@/platform/ids/user-id.js";

// ADR-0022 outbound port. Billing distinguishes two levels of access to an org's
// subscription: any member may read it, only an admin may take on or cancel a
// financial commitment. Both answers come from the organization module, so they
// share one port rather than splitting per question.
//
// `isAdmin` is a boolean, not a role list: which org role confers billing
// authority is a decision the adapter makes, so a change to the org module's
// role vocabulary never reaches billing's policies.
export type OrganizationAccessShape = {
  readonly isMember: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<boolean, PersistenceUnavailable>;
  readonly isAdmin: (
    userId: UserId,
    organizationId: OrganizationId,
  ) => Effect.Effect<boolean, PersistenceUnavailable>;
};

export class OrganizationAccess extends Context.Service<
  OrganizationAccess,
  OrganizationAccessShape
>()("@org/server/billing/OrganizationAccess") {}
