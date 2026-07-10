import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { MintApiTokenCommand } from "@/modules/auth/commands/mint-api-token.command.js";
import { mintApiToken } from "@/modules/auth/commands/mint-api-token.handler.js";
import { API_TOKEN_PREFIX } from "@/modules/auth/domain/api-token.root-ops.js";
import { CredentialHash } from "@/modules/auth/domain/credential-hash.domain-service.js";
import { ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token.repository.js";
import { ApiTokenRepositoryFake } from "@/modules/auth/infrastructure/repositories/api-token.repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const TestLayer = Layer.mergeAll(ApiTokenRepositoryFake, IdentityUnitOfWork);

describe("mintApiToken", () => {
  it.effect("returns a plaintext token once and persists only its hash", () =>
    Effect.gen(function* () {
      const { apiToken, token } = yield* mintApiToken(
        MintApiTokenCommand.make({ userId, label: "ci", expiresInDays: 90 }),
      );
      // Plaintext is the prefixed opaque token; the stored hash matches it.
      ok(token.startsWith(`${API_TOKEN_PREFIX}_`));
      deepStrictEqual(apiToken.tokenHash, CredentialHash.of(token));
      ok(!apiToken.tokenHash.includes(token));
      // The display prefix is a leading, non-secret fragment of the token.
      ok(token.startsWith(apiToken.prefix));
      deepStrictEqual(apiToken.userId, userId);
      deepStrictEqual(apiToken.label, "ci");
      deepStrictEqual(apiToken.revokedAt, null);
      ok(apiToken.expiresAt !== null);

      // Round-trips: the minted token resolves by its hash.
      const repo = yield* ApiTokenRepository;
      const found = yield* repo.findOneByHash(CredentialHash.of(token));
      deepStrictEqual(found.id, apiToken.id);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("mints distinct tokens on each call", () =>
    Effect.gen(function* () {
      const a = yield* mintApiToken(
        MintApiTokenCommand.make({ userId, label: "a", expiresInDays: 1 }),
      );
      const b = yield* mintApiToken(
        MintApiTokenCommand.make({ userId, label: "b", expiresInDays: 1 }),
      );
      ok(a.token !== b.token);
      ok(a.apiToken.id !== b.apiToken.id);
    }).pipe(Effect.provide(TestLayer)),
  );
});
