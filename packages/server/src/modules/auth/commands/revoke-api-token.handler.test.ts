import { describe, it } from "@effect/vitest";
import { assertInstanceOf, assertSome, assertTrue } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id";
import { mintApiTokenHandler } from "@/modules/auth/commands/mint-api-token.handler";
import { revokeApiTokenHandler } from "@/modules/auth/commands/revoke-api-token.handler";
import { ApiTokenNotFound } from "@/modules/auth/domain/api-token/api-token.errors";
import { ApiTokenId } from "@/modules/auth/domain/api-token/api-token.id";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository";
import { ApiTokenSpecifications } from "@/modules/auth/domain/api-token/api-token.specification";
import { ApiTokenRepositoryFake } from "@/modules/auth/infrastructure/repositories/api-token.repository-fake";
import { CryptoFake } from "@/test-utils/crypto-fake";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const otherUserId = UserId.make("22222222-2222-2222-2222-222222222222");
const TestLayer = Layer.mergeAll(ApiTokenRepositoryFake, PassThroughUnitOfWork, CryptoFake);

const mint = (owner: UserId) =>
  mintApiTokenHandler({ userId: owner, label: "ci", expiresInDays: 90 });

describe("revokeApiTokenHandler", () => {
  it.effect("revokes the caller's own token", () =>
    Effect.gen(function* () {
      const { apiToken } = yield* mint(userId);
      yield* revokeApiTokenHandler({ apiTokenId: apiToken.id, userId });
      const repo = yield* ApiTokenRepository;
      const found = yield* repo.findOne(ApiTokenSpecifications.withId(apiToken.id));

      assertTrue(Option.isSome(found));
      assertTrue(Option.isSome(found.value.revokedAt));
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("refuses (as NotFound) to revoke another user's token, leaving it active", () =>
    Effect.gen(function* () {
      const { apiToken } = yield* mint(otherUserId);
      const error = yield* Effect.flip(revokeApiTokenHandler({ apiTokenId: apiToken.id, userId }));
      assertInstanceOf(error, ApiTokenNotFound);

      const repo = yield* ApiTokenRepository;
      const found = yield* repo.findOne(ApiTokenSpecifications.withId(apiToken.id));

      assertSome(
        Option.map(found, (token) => Option.isNone(token.revokedAt)),
        true,
      );
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails ApiTokenNotFound for an unknown id", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        revokeApiTokenHandler({
          apiTokenId: ApiTokenId.make("99999999-9999-9999-9999-999999999999"),
          userId,
        }),
      );

      assertInstanceOf(error, ApiTokenNotFound);
    }).pipe(Effect.provide(TestLayer)),
  );
});
