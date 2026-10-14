import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertInstanceOf, assertNone } from "@effect/vitest/utils";
import { PassThroughUnitOfWork } from "@effect-server-utils/unit-of-work/testing";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import { signInHandler } from "@/modules/auth/commands/sign-in.handler.js";
import {
  IdentityEmailAlreadyRegistered,
  IdentityMissingEmail,
} from "@/modules/auth/domain/auth-identity/auth-identity.errors.js";
import {
  type AuthIdentity,
  AuthIdentityRepository,
} from "@/modules/auth/domain/auth-identity/auth-identity.repository.js";
import { AuthIdentitySpecifications } from "@/modules/auth/domain/auth-identity/auth-identity.specification.js";
import { SessionRepository } from "@/modules/auth/domain/session/session.repository.js";
import { SessionSpecifications } from "@/modules/auth/domain/session/session.specification.js";
import { makeUserProvisioningFake } from "@/modules/auth/infrastructure/acl/user-provisioning.acl-fake.js";
import { makeAuthIdentityRepositoryFake } from "@/modules/auth/infrastructure/repositories/auth-identity.repository-fake.js";
import { SessionRepositoryFake } from "@/modules/auth/infrastructure/repositories/session.repository-fake.js";
import { CryptoFake } from "@/test-utils/crypto-fake.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const provisionedUserId = UserId.make("22222222-2222-2222-2222-222222222222");
const subject = "identity-sub-1";

const seededIdentities: ReadonlyArray<AuthIdentity> = [
  { subject, userId, provider: "better-auth" },
];

// Known subject is pre-seeded; provisioning would mint `provisionedUserId`
// for an unknown subject.
const TestLayer = Layer.mergeAll(
  SessionRepositoryFake,
  makeAuthIdentityRepositoryFake(seededIdentities),
  makeUserProvisioningFake({ userId: provisionedUserId }),
  PassThroughUnitOfWork,
  CryptoFake,
);

const command = {
  subject,
  email: Option.some("admin@example.com"),
  emailVerified: true,
  ttlSeconds: 3600,
  absoluteTtlSeconds: 43200,
};

describe("signInHandler", () => {
  it.effect("creates a session and returns the new sessionId for a known subject", () =>
    Effect.gen(function* () {
      const result = yield* signInHandler(command);
      deepStrictEqual(result.userId, userId);
      const sessions = yield* SessionRepository;

      const stored = yield* sessions
        .findOne(SessionSpecifications.withId(result.sessionId))
        .pipe(Effect.flatMap(Effect.fromOption));

      deepStrictEqual(stored.userId, userId);
      deepStrictEqual(stored.subject, subject);
      assertNone(stored.revokedAt);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("JIT-provisions a user and links the identity for an unknown subject", () =>
    Effect.gen(function* () {
      const result = yield* signInHandler({
        ...command,
        subject: "new-subject",
        email: Option.some("new@example.com"),
      });

      // The session is created for the freshly-provisioned user…
      deepStrictEqual(result.userId, provisionedUserId);
      // …and the identity is now linked, so a subsequent lookup finds it.
      const identities = yield* AuthIdentityRepository;

      const linked = yield* identities
        .findOne(AuthIdentitySpecifications.bySubject("new-subject"))
        .pipe(Effect.flatMap(Effect.fromOption));

      deepStrictEqual(linked.userId, provisionedUserId);
      deepStrictEqual(linked.provider, "better-auth");
      const sessions = yield* SessionRepository;

      const stored = yield* sessions
        .findOne(SessionSpecifications.withId(result.sessionId))
        .pipe(Effect.flatMap(Effect.fromOption));

      deepStrictEqual(stored.userId, provisionedUserId);
    }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "fails IdentityMissingEmail when an unknown subject has no email to provision with",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          signInHandler({ ...command, subject: "no-email-subject", email: Option.none() }),
        );

        assertInstanceOf(error, IdentityMissingEmail);
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect(
    "fails IdentityEmailAlreadyRegistered when provisioning conflicts on a registered email",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          signInHandler({
            ...command,
            subject: "dup-subject",
            email: Option.some("taken@example.com"),
          }),
        );

        assertInstanceOf(error, IdentityEmailAlreadyRegistered);
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            SessionRepositoryFake,
            makeAuthIdentityRepositoryFake(seededIdentities),
            makeUserProvisioningFake({ conflicts: new Set(["taken@example.com"]) }),
            PassThroughUnitOfWork,
            CryptoFake,
          ),
        ),
      ),
  );

  it.effect("links a new identity to the user already registered under its verified email", () => {
    const existingUserId = UserId.make("33333333-3333-3333-3333-333333333333");

    return Effect.gen(function* () {
      const result = yield* signInHandler({
        ...command,
        subject: "second-identity",
        email: Option.some("member@example.com"),
        emailVerified: true,
      });

      deepStrictEqual(result.userId, existingUserId);
      const identities = yield* AuthIdentityRepository;

      const linked = yield* identities
        .findOne(AuthIdentitySpecifications.bySubject("second-identity"))
        .pipe(Effect.flatMap(Effect.fromOption));

      deepStrictEqual(linked.userId, existingUserId);
      deepStrictEqual(linked.provider, "better-auth");
    }).pipe(
      Effect.provide(
        Layer.mergeAll(
          SessionRepositoryFake,
          makeAuthIdentityRepositoryFake(seededIdentities),
          makeUserProvisioningFake({
            existing: new Map([["member@example.com", existingUserId]]),
          }),
          PassThroughUnitOfWork,
          CryptoFake,
        ),
      ),
    );
  });

  it.effect(
    "refuses to link on an unverified email, so whoever claims an address cannot take its account",
    () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(
          signInHandler({
            ...command,
            subject: "unverified-identity",
            email: Option.some("member@example.com"),
            emailVerified: false,
          }),
        );

        assertInstanceOf(error, IdentityEmailAlreadyRegistered);
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            SessionRepositoryFake,
            makeAuthIdentityRepositoryFake(seededIdentities),
            makeUserProvisioningFake({
              existing: new Map([
                ["member@example.com", UserId.make("33333333-3333-3333-3333-333333333333")],
              ]),
            }),
            PassThroughUnitOfWork,
            CryptoFake,
          ),
        ),
      ),
  );
});
