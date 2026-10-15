import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable";
import { touchApiTokenHandler } from "@/modules/auth/commands/touch-api-token.handler";
import { ApiTokenNotFound } from "@/modules/auth/domain/api-token/api-token.errors";
import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token/api-token.root-ops";
import { ApiTokenSpecifications } from "@/modules/auth/domain/api-token/api-token.specification";
import { ApiTokenRepositoryFake } from "@/modules/auth/infrastructure/repositories/api-token.repository-fake";

const apiTokenId = ApiTokenId.make("11111111-1111-1111-1111-111111111111");
const userId = UserId.make("22222222-2222-2222-2222-222222222222");

const seed = (lastUsedAt: DateTime.Utc) =>
  Effect.gen(function* () {
    const repo = yield* ApiTokenRepository;

    const token = ApiTokenRootOps.mint({
      id: apiTokenId,
      userId,
      tokenHash: "hash",
      prefix: "pat_abcd1234",
      label: "ci",
      now: lastUsedAt,
      expiresAt: Option.some(DateTime.add(lastUsedAt, { days: 90 })),
    });

    yield* repo.insertOne(token);

    return token;
  });

const cmd = { apiTokenId, thresholdSeconds: 60 };
const provide = Effect.provide(ApiTokenRepositoryFake);

const updateOneFailingWith = (failure: ApiTokenNotFound | PersistenceUnavailable) =>
  Layer.effect(
    ApiTokenRepository,
    Effect.gen(function* () {
      const repo = yield* ApiTokenRepository;

      return ApiTokenRepository.of({ ...repo, updateOne: () => failure });
    }),
  ).pipe(Layer.provide(ApiTokenRepositoryFake));

const farPast = DateTime.makeUnsafe("2000-01-01T00:00:00Z");

describe("touchApiTokenHandler", () => {
  // `it.live` uses the real Clock so `DateTime.now` in the handler is "now",
  // making the throttle window meaningful (the TestClock sits at epoch 0).
  it.live("stamps lastUsedAt once the throttle window has elapsed", () =>
    Effect.gen(function* () {
      const before = yield* seed(farPast);
      yield* touchApiTokenHandler(cmd);
      const repo = yield* ApiTokenRepository;

      const after = yield* repo
        .findOne(ApiTokenSpecifications.withId(apiTokenId))
        .pipe(Effect.flatMap(Effect.fromOption));

      deepStrictEqual(DateTime.isGreaterThan(after.lastUsedAt, before.lastUsedAt), true);
      // Fixed expiry: touch must NOT extend it.
      deepStrictEqual(after.expiresAt, before.expiresAt);
    }).pipe(provide),
  );

  it.live("skips the write while within the throttle window", () =>
    Effect.gen(function* () {
      const justNow = yield* DateTime.now;
      const before = yield* seed(justNow);
      yield* touchApiTokenHandler({ apiTokenId, thresholdSeconds: 3600 });
      const repo = yield* ApiTokenRepository;

      const after = yield* repo
        .findOne(ApiTokenSpecifications.withId(apiTokenId))
        .pipe(Effect.flatMap(Effect.fromOption));

      deepStrictEqual(after.lastUsedAt, before.lastUsedAt);
    }).pipe(provide),
  );

  it.effect("is a no-op on a missing token (error channel is never)", () =>
    Effect.gen(function* () {
      yield* touchApiTokenHandler(cmd);
      deepStrictEqual(true, true);
    }).pipe(provide),
  );

  it.live("does not fail when the token is revoked between lookup and update (benign race)", () =>
    Effect.gen(function* () {
      yield* seed(farPast);
      yield* touchApiTokenHandler(cmd);
    }).pipe(Effect.provide(updateOneFailingWith(new ApiTokenNotFound()))),
  );

  it.live("does not fail a request the bearer check already admitted when the store is down", () =>
    Effect.gen(function* () {
      yield* seed(farPast);
      yield* touchApiTokenHandler(cmd);
    }).pipe(Effect.provide(updateOneFailingWith(new PersistenceUnavailable({ message: "down" })))),
  );
});
