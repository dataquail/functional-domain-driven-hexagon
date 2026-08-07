import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { QueryBus } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { FindOrganizationByIdQuery } from "@/modules/organization/queries/find-organization-by-id.query.js";
import { type Resolver } from "@/platform/auth/resource-resolver-registry.js";

// Resolves the `organization` authz resource off the read side: the checks only
// need the org id, and the load exists to distinguish "no such organization"
// (NotFound → the endpoint's own *NotFoundError) from "not permitted".
//
// Soft-deleted rows resolve too. The restore endpoint has to reach a tombstoned
// organization to decide whether the caller may act on it, and the soft-delete
// endpoint sees an active row at resolution time.
//
// A transient store outage propagates untouched, so the endpoint's
// `recoverPersistenceUnavailable` turns it into the same 503 it would have
// produced had the outage struck the use case instead.
export class OrganizationResolverEntry extends Context.Service<
  OrganizationResolverEntry,
  Resolver<"organization">
>()("OrganizationResolverEntry") {}

export const OrganizationResolverEntryLive = Layer.effect(
  OrganizationResolverEntry,
  Effect.gen(function* () {
    const queryBus = yield* QueryBus;
    return (organizationId) =>
      queryBus
        .execute(FindOrganizationByIdQuery, { organizationId })
        .pipe(
          Effect.flatMap((view) =>
            view === null ? Effect.fail(new CustomHttpApiError.NotFound()) : Effect.succeed(view),
          ),
        );
  }),
);
