import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { FindMembershipQuery } from "@/modules/organization/index.js";
import { OrganizationAccess } from "@/modules/todos/domain/ports/acl/organization-access.acl.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";

// ADR-0022 outbound adapter. Dispatches the organization module's published
// policy-query so the membership determination stays an explicit question to the
// owning module rather than a reach into its tables (ADR-0020 bans cross-schema
// SQL anyway). `Database` is captured at construction and re-provided to the
// dispatched effect so the port's method surface stays `R = never`.
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
    });
  }),
);
