import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Effect from "effect/Effect";

import { type Resolver } from "@/platform/auth/resource-resolver-registry.js";

import { type UserRepositoryShape } from "../domain/user-repository.js";

// Factory: pre-bound with a UserRepository instance from the composition
// root, returns the resolver entry the resource registry expects. The
// closure keeps `platform/auth/` ignorant of UserRepository (the Tag is
// module-internal) while letting the registry call out to the repo at
// runtime.
//
// PersistenceUnavailable is treated as an unrecoverable failure here
// (die) — Phase 4 may revisit and surface 503 via a richer resolver
// signature. For Phase 1.5 the two known callers run in scope of the
// HTTP middleware which already maps 503 via the group's error channel.
export const makeUserResourceResolverEntry = (
  repo: UserRepositoryShape,
): { readonly key: "user"; readonly resolver: Resolver<"user"> } => ({
  key: "user",
  resolver: (id) =>
    repo.findById(id).pipe(
      Effect.catchTag("UserNotFound", () => Effect.fail(new CustomHttpApiError.NotFound())),
      Effect.catchTag("PersistenceUnavailable", Effect.die),
    ),
});
