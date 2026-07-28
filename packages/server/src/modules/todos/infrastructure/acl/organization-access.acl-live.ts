import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationQueries } from "@/modules/organization/index.js";
import { OrganizationAccess } from "@/modules/todos/domain/ports/acl/organization-access.acl.js";

// ADR-0022 outbound adapter. Dispatches the organization module's published
// policy-query so the membership determination stays an explicit question to the
// owning module rather than a reach into its tables (ADR-0020 bans cross-schema
// SQL anyway). It resolves that module's own dispatch surface rather than the app-wide
// bus, so a module whose handlers need this port does not end up depending on the bus that
// routes those handlers.
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
    });
  }),
);
