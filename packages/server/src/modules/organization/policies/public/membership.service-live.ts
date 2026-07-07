import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { FindMembershipQuery } from "@/modules/organization/queries/find-membership.query.js";
import { MembershipService } from "@/platform/ddd/ports/membership-service.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";

// Surfaces the org module's membership state to policies via the
// generalized `MembershipService` ACL. Delegates through the query bus
// (`FindMembershipQuery`) rather than reaching the `MembershipRepository`
// in-process, so the cross-module membership lookup is an explicit query
// against the org module — the single source of truth. Same shape as
// `RoleServiceLive`: the query handler self-wraps its repository, leaving
// `Database` as the dispatch's residual R, which we capture and provide
// inline so the `MembershipService` Tag stays R = never for consumers.
export const MembershipServiceLive = Layer.effect(
  MembershipService,
  Effect.gen(function* () {
    const queryBus = yield* QueryBus;
    const db = yield* Database.Database;

    return MembershipService.of({
      isMember: (userId, organizationId) =>
        queryBus.execute(FindMembershipQuery.make({ userId, organizationId })).pipe(
          Effect.provideService(Database.Database, db),
          Effect.map((result) => result.isMember),
          Effect.withSpan("MembershipService.isMember"),
        ),
    });
  }),
);
