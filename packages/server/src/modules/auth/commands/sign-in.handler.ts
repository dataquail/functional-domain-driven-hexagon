import { withUnitOfWork } from "@effect-server-utils/unit-of-work";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type SignInPayload } from "@/modules/auth/commands/sign-in.command.js";
import {
  IdentityEmailAlreadyRegistered,
  IdentityMissingEmail,
} from "@/modules/auth/domain/auth-identity/auth-identity.errors.js";
import { AuthIdentityRepository } from "@/modules/auth/domain/auth-identity/auth-identity.repository.js";
import { AuthIdentitySpecifications } from "@/modules/auth/domain/auth-identity/auth-identity.specification.js";
import { UserProvisioning } from "@/modules/auth/domain/ports/acl/user-provisioning.acl.js";
import { SessionId } from "@/modules/auth/domain/session/session.id.js";
import { SessionRepository } from "@/modules/auth/domain/session/session.repository.js";
import { SessionRootOps } from "@/modules/auth/domain/session/session.root-ops.js";

const IDENTITY_PROVIDER = "better-auth";

export const signInHandler = Effect.fn("signInHandler")(function* (cmd: SignInPayload) {
  const identities = yield* AuthIdentityRepository;
  const sessions = yield* SessionRepository;
  const provisioning = yield* UserProvisioning;

  const identity = yield* identities.findOne(AuthIdentitySpecifications.bySubject(cmd.subject));
  const userId =
    identity !== null
      ? identity.userId
      : yield* Effect.gen(function* () {
          if (cmd.email === null) {
            return yield* new IdentityMissingEmail({ subject: cmd.subject });
          }
          const email = cmd.email;
          // Only a verified address proves the new identity owns the existing account.
          const existingUserId = cmd.emailVerified ? yield* provisioning.findByEmail(email) : null;
          const linkedUserId =
            existingUserId ??
            (yield* provisioning
              .provision(email)
              .pipe(
                Effect.catchTag(
                  "UserProvisioningConflict",
                  (e) => new IdentityEmailAlreadyRegistered({ email: e.email }),
                ),
              ));
          yield* identities.insertOne({
            subject: cmd.subject,
            userId: linkedUserId,
            provider: IDENTITY_PROVIDER,
          });
          return linkedUserId;
        });

  const id = SessionId.make(yield* Effect.sync(() => crypto.randomUUID()));
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
