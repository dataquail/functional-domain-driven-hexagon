import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type Resolver } from "@/platform/auth/resource-resolver-registry.js";

import { OrganizationRepository } from "../domain/ports/repositories/organization.repository.js";
import { OrganizationRepositoryLive } from "../infrastructure/repositories/organization.repository-live.js";

// Resolver loads soft-deleted rows too. The restore endpoint
// (`Authz.hasPermissions(OrganizationResource, Actions.Update, id)`)
// needs the tombstoned aggregate to compute "can the caller update
// this," and the soft-delete endpoint sees an active row at the time
// of resolution. Keeping a single `organization` resolver in
// `ResourceResolverMap` is simpler than splitting into active vs.
// with-deleted flavors.
//
// PersistenceUnavailable dies inside the resolver — the boundary that
// converts it to a 503 is the endpoint's `recoverPersistenceUnavailable`,
// same shape as the user resolver.
export class OrganizationResolverEntry extends Context.Tag("OrganizationResolverEntry")<
  OrganizationResolverEntry,
  Resolver<"organization">
>() {}

export const OrganizationResolverEntryLive = Layer.effect(
  OrganizationResolverEntry,
  Effect.gen(function* () {
    const repo = yield* OrganizationRepository;
    return (id) =>
      repo.findOneByIdIncludingDeleted(id).pipe(
        Effect.catchTag("OrganizationNotFound", () =>
          Effect.fail(new CustomHttpApiError.NotFound()),
        ),
        Effect.catchTag("PersistenceUnavailable", Effect.die),
      );
  }),
).pipe(Layer.provide(OrganizationRepositoryLive));
