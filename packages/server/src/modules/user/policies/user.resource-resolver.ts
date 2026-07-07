import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { type Resolver } from "@/platform/auth/resource-resolver-registry.js";

import { UserRepository } from "../domain/ports/repositories/user.repository.js";
import { UserRepositoryLive } from "../infrastructure/repositories/user.repository-live.js";

// PersistenceUnavailable is treated as an unrecoverable failure here
// (die) — the two known callers run in scope of the HTTP middleware
// which already maps 503 via the group's error channel.
export class UserResolverEntry extends Context.Tag("UserResolverEntry")<
  UserResolverEntry,
  Resolver<"user">
>() {}

export const UserResolverEntryLive = Layer.effect(
  UserResolverEntry,
  Effect.gen(function* () {
    const repo = yield* UserRepository;
    return (id) =>
      repo.findOneById(id).pipe(
        Effect.catchTag("UserNotFound", () => Effect.fail(new CustomHttpApiError.NotFound())),
        Effect.catchTag("PersistenceUnavailable", Effect.die),
      );
  }),
).pipe(Layer.provide(UserRepositoryLive));
