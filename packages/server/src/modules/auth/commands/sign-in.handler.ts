import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";

import { type SignInPayload } from "@/modules/auth/commands/sign-in.command";
import {
  IdentityEmailAlreadyRegistered,
  IdentityMissingEmail,
} from "@/modules/auth/domain/auth-identity/auth-identity.errors";
import { AuthIdentityRepository } from "@/modules/auth/domain/auth-identity/auth-identity.repository";
import { AuthIdentitySpecifications } from "@/modules/auth/domain/auth-identity/auth-identity.specification";
import { UserProvisioning } from "@/modules/auth/domain/ports/acl/user-provisioning.acl";
import { SessionId } from "@/modules/auth/domain/session/session.id";
import { SessionRepository } from "@/modules/auth/domain/session/session.repository";
import { SessionRootOps } from "@/modules/auth/domain/session/session.root-ops";

const IDENTITY_PROVIDER = "better-auth";

// First sign-in of an unknown subject: link it to the user already registered
// under a verified email, or provision a new one.
const linkNewIdentity = Effect.fnUntraced(function* (cmd: SignInPayload) {
  const identities = yield* AuthIdentityRepository;
  const provisioning = yield* UserProvisioning;

  if (Option.isNone(cmd.email)) {
    return yield* new IdentityMissingEmail({ subject: cmd.subject });
  }

  const email = cmd.email.value;

  // Only a verified address proves the new identity owns the existing account.
  const existingUserId = yield* provisioning
    .findByEmail(email)
    .pipe(Effect.when(Effect.succeed(cmd.emailVerified)), Effect.map(Option.flatten));

  const linkedUserId = yield* Option.match(existingUserId, {
    onSome: Effect.succeed,
    onNone: () =>
      provisioning
        .provision(email)
        .pipe(
          Effect.catchTag(
            "UserProvisioningConflict",
            (e) => new IdentityEmailAlreadyRegistered({ email: e.email }),
          ),
        ),
  });

  yield* identities.insertOne({
    subject: cmd.subject,
    userId: linkedUserId,
    provider: IDENTITY_PROVIDER,
  });

  return linkedUserId;
});

export const signInHandler = Effect.fn("signInHandler")(function* (cmd: SignInPayload) {
  const identities = yield* AuthIdentityRepository;
  const sessions = yield* SessionRepository;

  const identity = yield* identities.findOne(AuthIdentitySpecifications.bySubject(cmd.subject));

  const userId = yield* Option.match(identity, {
    onSome: (found) => Effect.succeed(found.userId),
    onNone: () => linkNewIdentity(cmd),
  });

  const id = SessionId.make(yield* Effect.orDie((yield* Crypto.Crypto).randomUUIDv4));
  const now = yield* DateTime.now;

  const session = SessionRootOps.create({
    id,
    userId,
    subject: cmd.subject,
    now,
    ttlSeconds: cmd.ttlSeconds,
    absoluteTtlSeconds: cmd.absoluteTtlSeconds,
  });

  yield* sessions.insertOne(session);
  yield* Effect.annotateCurrentSpan("user.id", userId);

  return { sessionId: id, userId };
}, withUnitOfWork);
