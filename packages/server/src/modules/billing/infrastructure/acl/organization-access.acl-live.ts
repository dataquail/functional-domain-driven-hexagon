import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationAccess } from "@/modules/billing/domain/ports/acl/organization-access.acl.js";
import {
  FindMembershipQuery,
  FindUserOrganizationRolesQuery,
} from "@/modules/organization/index.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";

// The org role that confers authority over an organization's billing. Deciding
// this here — rather than in a policy — is what keeps the org module's role
// vocabulary out of billing.
const BILLING_ADMIN_ROLE = "admin";

// ADR-0022 outbound adapter. The only place in the billing module where the
// organization module's barrel is imported.
export const OrganizationAccessLive = Layer.effect(
  OrganizationAccess,
  Effect.gen(function* () {
    const queryBus = yield* QueryBus;
    const db = yield* Database.Database;

    return OrganizationAccess.of({
      isMember: (userId, organizationId) =>
        queryBus.execute(FindMembershipQuery.make({ userId, organizationId })).pipe(
          Effect.provideService(Database.Database, db),
          Effect.map((result) => result.isMember),
          Effect.withSpan("OrganizationAccess.isMember"),
        ),
      isAdmin: (userId, organizationId) =>
        queryBus.execute(FindUserOrganizationRolesQuery.make({ userId, organizationId })).pipe(
          Effect.provideService(Database.Database, db),
          Effect.map((result) => result.roles.includes(BILLING_ADMIN_ROLE)),
          Effect.withSpan("OrganizationAccess.isAdmin"),
        ),
    });
  }),
);
