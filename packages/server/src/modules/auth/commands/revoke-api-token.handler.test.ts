import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { MintApiTokenCommand } from "@/modules/auth/commands/mint-api-token.command.js";
import { mintApiToken } from "@/modules/auth/commands/mint-api-token.handler.js";
import { RevokeApiTokenCommand } from "@/modules/auth/commands/revoke-api-token.command.js";
import { revokeApiToken } from "@/modules/auth/commands/revoke-api-token.handler.js";
import { ApiTokenNotFound } from "@/modules/auth/domain/api-token.errors.js";
import { ApiTokenId } from "@/modules/auth/domain/api-token.id.js";
import { ApiTokenRepository } from "@/modules/auth/domain/ports/repositories/api-token.repository.js";
import { ApiTokenRepositoryFake } from "@/modules/auth/infrastructure/repositories/api-token.repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const otherUserId = UserId.make("22222222-2222-2222-2222-222222222222");
const TestLayer = Layer.mergeAll(ApiTokenRepositoryFake, IdentityUnitOfWork);

const mint = (owner: UserId) =>
  mintApiToken(MintApiTokenCommand.make({ userId: owner, label: "ci", expiresInDays: 90 }));

describe("revokeApiToken", () => {
  it.effect("revokes the caller's own token", () =>
    Effect.gen(function* () {
      const { apiToken } = yield* mint(userId);
      yield* revokeApiToken(RevokeApiTokenCommand.make({ apiTokenId: apiToken.id, userId }));
      const repo = yield* ApiTokenRepository;
      deepStrictEqual((yield* repo.findOneById(apiToken.id)).revokedAt !== null, true);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("refuses (as NotFound) to revoke another user's token, leaving it active", () =>
    Effect.gen(function* () {
      const { apiToken } = yield* mint(otherUserId);
      const exit = yield* Effect.exit(
        revokeApiToken(RevokeApiTokenCommand.make({ apiTokenId: apiToken.id, userId })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause) ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) : null;
        deepStrictEqual(error instanceof ApiTokenNotFound, true);
      }
      const repo = yield* ApiTokenRepository;
      deepStrictEqual((yield* repo.findOneById(apiToken.id)).revokedAt, null);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails ApiTokenNotFound for an unknown id", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        revokeApiToken(
          RevokeApiTokenCommand.make({
            apiTokenId: ApiTokenId.make("99999999-9999-9999-9999-999999999999"),
            userId,
          }),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
    }).pipe(Effect.provide(TestLayer)),
  );
});
