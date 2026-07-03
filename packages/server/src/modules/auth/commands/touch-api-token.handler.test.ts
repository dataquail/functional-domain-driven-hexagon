import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { TouchApiTokenCommand } from "@/modules/auth/commands/touch-api-token.command.js";
import { touchApiToken } from "@/modules/auth/commands/touch-api-token.handler.js";
import { ApiTokenId } from "@/modules/auth/domain/api-token.id.js";
import { ApiTokenRootOps } from "@/modules/auth/domain/api-token.root.js";
import { ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token.repository.js";
import { ApiTokenRepositoryFake } from "@/modules/auth/infrastructure/repositories/api-token.repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";

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
      expiresAt: DateTime.add(lastUsedAt, { days: 90 }),
    });
    yield* repo.insertOne(token);
    return token;
  });

const cmd = TouchApiTokenCommand.make({ apiTokenId, thresholdSeconds: 60 });
const provide = Effect.provide(ApiTokenRepositoryFake);

describe("touchApiToken", () => {
  // `it.live` uses the real Clock so `DateTime.now` in the handler is "now",
  // making the throttle window meaningful (the TestClock sits at epoch 0).
  it.live("stamps lastUsedAt once the throttle window has elapsed", () =>
    Effect.gen(function* () {
      const farPast = DateTime.unsafeMake(new Date("2000-01-01T00:00:00Z"));
      const before = yield* seed(farPast);
      yield* touchApiToken(cmd);
      const repo = yield* ApiTokenRepository;
      const after = yield* repo.findOneById(apiTokenId);
      deepStrictEqual(DateTime.greaterThan(after.lastUsedAt, before.lastUsedAt), true);
      // Fixed expiry: touch must NOT extend it.
      deepStrictEqual(after.expiresAt, before.expiresAt);
    }).pipe(provide),
  );

  it.live("skips the write while within the throttle window", () =>
    Effect.gen(function* () {
      const justNow = yield* DateTime.now;
      const before = yield* seed(justNow);
      yield* touchApiToken(TouchApiTokenCommand.make({ apiTokenId, thresholdSeconds: 3600 }));
      const repo = yield* ApiTokenRepository;
      const after = yield* repo.findOneById(apiTokenId);
      deepStrictEqual(after.lastUsedAt, before.lastUsedAt);
    }).pipe(provide),
  );

  it.effect("is a no-op on a missing token (error channel is never)", () =>
    Effect.gen(function* () {
      yield* touchApiToken(cmd);
      deepStrictEqual(true, true);
    }).pipe(provide),
  );
});
