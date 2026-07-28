import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationAccess } from "@/modules/billing/domain/ports/acl/organization-access.acl.js";
import { OrganizationQueries } from "@/modules/organization/index.js";

// The org role that confers authority over an organization's billing. Deciding
// this here — rather than in a policy — is what keeps the org module's role
// vocabulary out of billing.
const BILLING_ADMIN_ROLE = "admin";

// ADR-0022 outbound adapter. The only place in the billing module where the organization
// module's barrel is imported. It resolves that module's own dispatch surface rather than
// the app-wide bus, so a module whose handlers need this port does not end up depending on
// the bus that routes those handlers.
export const OrganizationAccessLive = Layer.effect(
  OrganizationAccess,
  Effect.gen(function* () {
    const organizationQueries = yield* OrganizationQueries;
    return OrganizationAccess.of({
      isMember: (userId, organizationId) =>
        organizationQueries.FindMembershipQuery({ userId, organizationId }).pipe(
          Effect.map((result) => result.isMember),
          Effect.withSpan("OrganizationAccess.isMember"),
        ),
      isAdmin: (userId, organizationId) =>
        organizationQueries.FindUserOrganizationRolesQuery({ userId, organizationId }).pipe(
          Effect.map((result) => result.roles.includes(BILLING_ADMIN_ROLE)),
          Effect.withSpan("OrganizationAccess.isAdmin"),
        ),
    });
  }),
);
