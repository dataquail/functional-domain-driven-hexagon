import { withUnitOfWork } from "@org/cqrs";
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

// Slice-scope SignInCommand:
//   - looks up auth_identities by Zitadel subject
//   - admins are pre-seeded by infra/zitadel/seed.mjs, so the row exists
//   - an unknown subject is just-in-time provisioned as an ordinary
//     (non-admin) user: `UserProvisioning.provision` fires the user module's
//     CreateUserCommand and returns the new id, then we link the identity.
//     Provisioning, identity link, and session insert all run in one
//     unit of work, so a failure anywhere rolls the whole sign-in back (the
//     provisioning command joins this transaction — `UnitOfWorkLive` is
//     re-entrant). An ordinary user gets no `platform.roles` row.
//   - creates and persists a Session, returns its id
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time, so no inline
// `withSpan` here.
export const signInHandler = Effect.fn("signInHandler")(function* (cmd: SignInPayload) {
  const identities = yield* AuthIdentityRepository;
  const sessions = yield* SessionRepository;
  const provisioning = yield* UserProvisioning;

  const identity = yield* identities.findOne(AuthIdentitySpecifications.bySubject(cmd.subject));
  const userId =
    identity !== null
      ? identity.userId
      : // First sign-in for this subject: JIT provision an ordinary user.
        // Requires an email (the `users` row needs one); a verified
        // identity with no email can't be provisioned. The provisioning
        // command runs in this same transaction.
        yield* Effect.gen(function* () {
          if (cmd.email === null) {
            return yield* new IdentityMissingEmail({ subject: cmd.subject });
          }
          const newUserId = yield* provisioning
            .provision(cmd.email)
            .pipe(
              Effect.catchTag("UserProvisioningConflict", (e) =>
                Effect.fail(new IdentityEmailAlreadyRegistered({ email: e.email })),
              ),
            );
          yield* identities.insertOne({
            subject: cmd.subject,
            userId: newUserId,
            provider: "zitadel",
          });
          return newUserId;
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
