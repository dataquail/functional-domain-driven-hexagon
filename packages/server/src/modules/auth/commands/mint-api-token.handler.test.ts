import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.ts";
import { mintApiTokenHandler } from "@/modules/auth/commands/mint-api-token.handler.ts";
import { ApiTokenRepository } from "@/modules/auth/domain/api-token/api-token.repository.ts";
import { API_TOKEN_PREFIX } from "@/modules/auth/domain/api-token/api-token.root-ops.ts";
import { ApiTokenSpecifications } from "@/modules/auth/domain/api-token/api-token.specification.ts";
import { CredentialHash } from "@/modules/auth/domain/domain-services/credential-hash.domain-service.ts";
import { ApiTokenRepositoryFake } from "@/modules/auth/infrastructure/repositories/api-token.repository-fake.ts";
import { CryptoFake } from "@/test-utils/crypto-fake.ts";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const TestLayer = Layer.mergeAll(ApiTokenRepositoryFake, PassThroughUnitOfWork, CryptoFake);

describe("mintApiTokenHandler", () => {
  it.effect("returns a plaintext token once and persists only its hash", () =>
    Effect.gen(function* () {
      const { apiToken, token } = yield* mintApiTokenHandler({
        userId,
        label: "ci",
        expiresInDays: 90,
      });

      // Plaintext is the prefixed opaque token; the stored hash matches it.
      ok(token.startsWith(`${API_TOKEN_PREFIX}_`));
      deepStrictEqual(apiToken.tokenHash, CredentialHash.of(token));
      ok(!apiToken.tokenHash.includes(token));
      // The display prefix is a leading, non-secret fragment of the token.
      ok(token.startsWith(apiToken.prefix));
      deepStrictEqual(apiToken.userId, userId);
      deepStrictEqual(apiToken.label, "ci");
      assertNone(apiToken.revokedAt);
      assertTrue(Option.isSome(apiToken.expiresAt));

      // Round-trips: the minted token resolves by its hash.
      const repo = yield* ApiTokenRepository;
      const found = yield* repo.findOne(ApiTokenSpecifications.withHash(CredentialHash.of(token)));

      assertTrue(Option.isSome(found));
      deepStrictEqual(found.value.id, apiToken.id);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("mints distinct tokens on each call", () =>
    Effect.gen(function* () {
      const a = yield* mintApiTokenHandler({ userId, label: "a", expiresInDays: 1 });
      const b = yield* mintApiTokenHandler({ userId, label: "b", expiresInDays: 1 });
      ok(a.token !== b.token);
      ok(a.apiToken.id !== b.apiToken.id);
    }).pipe(Effect.provide(TestLayer)),
  );
});
