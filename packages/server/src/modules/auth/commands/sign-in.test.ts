import { describe, it } from "@effect/vitest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";

import { signIn } from "@/modules/auth/commands/sign-in.js";
import { SignInCommand } from "@/modules/auth/commands/sign-in-command.js";
import {
  type AuthIdentity,
  AuthIdentityRepository,
} from "@/modules/auth/domain/ports/repositories/auth-identity-repository.js";
import { SessionRepository } from "@/modules/auth/domain/ports/repositories/session-repository.js";
import { makeAuthIdentityRepositoryFake } from "@/modules/auth/infrastructure/auth-identity-repository-fake.js";
import { SessionRepositoryFake } from "@/modules/auth/infrastructure/session-repository-fake.js";
import { UserId } from "@/platform/ids/user-id.js";
import { IdentityUnitOfWork } from "@/test-utils/identity-unit-of-work.js";
import { makeUserProvisioningFake } from "@/test-utils/user-provisioning-fake.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const provisionedUserId = UserId.make("22222222-2222-2222-2222-222222222222");
const subject = "zitadel-sub-1";

const seededIdentities: ReadonlyArray<AuthIdentity> = [{ subject, userId, provider: "zitadel" }];

// Known subject is pre-seeded; provisioning would mint `provisionedUserId`
// for an unknown subject.
const TestLayer = Layer.mergeAll(
  SessionRepositoryFake,
  makeAuthIdentityRepositoryFake(seededIdentities),
  makeUserProvisioningFake({ userId: provisionedUserId }),
  IdentityUnitOfWork,
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

  it.effect("JIT-provisions a user and links the identity for an unknown subject", () =>
    Effect.gen(function* () {
      const result = yield* signIn(
        SignInCommand.make({ ...command, subject: "new-subject", email: "new@example.com" }),
      );
      // The session is created for the freshly-provisioned user…
      deepStrictEqual(result.userId, provisionedUserId);
      // …and the identity is now linked, so a subsequent lookup finds it.
      const identities = yield* AuthIdentityRepository;
      const linked = yield* identities.findBySubject("new-subject");
      deepStrictEqual(linked.userId, provisionedUserId);
      deepStrictEqual(linked.provider, "zitadel");
      const sessions = yield* SessionRepository;
      const stored = yield* sessions.findById(result.sessionId);
      deepStrictEqual(stored.userId, provisionedUserId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails Unauthorized when an unknown subject has no email to provision with", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        signIn(SignInCommand.make({ ...command, subject: "no-email-subject", email: null })),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof CustomHttpApiError.Unauthorized, true);
      }
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("fails Unauthorized when provisioning conflicts on an already-registered email", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        signIn(
          SignInCommand.make({ ...command, subject: "dup-subject", email: "taken@example.com" }),
        ).pipe(
          Effect.provide(
            Layer.mergeAll(
              SessionRepositoryFake,
              makeAuthIdentityRepositoryFake(seededIdentities),
              makeUserProvisioningFake({ conflicts: new Set(["taken@example.com"]) }),
              IdentityUnitOfWork,
            ),
          ),
        ),
      );
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = exit.cause._tag === "Fail" ? exit.cause.error : null;
        deepStrictEqual(error instanceof CustomHttpApiError.Unauthorized, true);
      }
    }),
  );
});
