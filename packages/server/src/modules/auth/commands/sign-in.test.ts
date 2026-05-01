import { SignInCommand } from "@/modules/auth/commands/sign-in-command.js";
import { signIn } from "@/modules/auth/commands/sign-in.js";
import { type AuthIdentity } from "@/modules/auth/domain/auth-identity-repository.js";
import { SessionRepository } from "@/modules/auth/domain/session-repository.js";
import { makeAuthIdentityRepositoryFake } from "@/modules/auth/infrastructure/auth-identity-repository-fake.js";
import { SessionRepositoryFake } from "@/modules/auth/infrastructure/session-repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { describe, it } from "@effect/vitest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const subject = "zitadel-sub-1";

const seededIdentities: ReadonlyArray<AuthIdentity> = [{ subject, userId, provider: "zitadel" }];

const TestLayer = Layer.mergeAll(
  SessionRepositoryFake,
  makeAuthIdentityRepositoryFake(seededIdentities),
);

const command = SignInCommand.make({
  subject,
  email: "admin@example.com",
  ttlSeconds: 3600,
  absoluteTtlSeconds: 43200,
});

describe("signIn", () => {
  it.effect("creates a session and returns the new sessionId for a known subject", () =>
    Effect.gen(function* () {
      const result = yield* signIn(command);
      deepStrictEqual(result.userId, userId);
      const sessions = yield* SessionRepository;
      const stored = yield* sessions.findById(result.sessionId);
      deepStrictEqual(stored.userId, userId);
      deepStrictEqual(stored.subject, subject);
      deepStrictEqual(stored.revokedAt, null);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails Unauthorized when no auth_identity exists for the subject", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        signIn(SignInCommand.make({ ...command, subject: "unknown-subject" })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof CustomHttpApiError.Unauthorized, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );
});
