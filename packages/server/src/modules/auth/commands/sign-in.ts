import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import { type SignInCommand, type SignInOutput } from "@/modules/auth/commands/sign-in-command.js";
import { AuthIdentityRepository } from "@/modules/auth/domain/ports/repositories/auth-identity-repository.js";
import { SessionRepository } from "@/modules/auth/domain/ports/repositories/session-repository.js";
import * as Session from "@/modules/auth/domain/session.aggregate.js";
import { SessionId } from "@/modules/auth/domain/session-id.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { UserProvisioning } from "@/platform/ddd/ports/user-provisioning.js";

// Slice-scope SignIn:
//   - looks up auth_identities by Zitadel subject
//   - admins are pre-seeded by infra/zitadel/seed.mjs, so the row exists
//   - an unknown subject is just-in-time provisioned as an ordinary
//     (non-admin) user: `UserProvisioning.provision` fires the user module's
//     CreateUserCommand and returns the new id, then we link the identity.
//     Provisioning, identity link, and session insert all run in one
//     `uow.run`, so a failure anywhere rolls the whole sign-in back (the
//     provisioning command joins this transaction — `UnitOfWorkLive` is
//     re-entrant). An ordinary user gets no `platform.roles` row.
//   - creates and persists a Session, returns its id
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time, so no inline
// `withSpan` here.
export const signIn = (cmd: SignInCommand): SignInOutput =>
  Effect.gen(function* () {
    const identities = yield* AuthIdentityRepository;
    const sessions = yield* SessionRepository;
    const provisioning = yield* UserProvisioning;
    const uow = yield* UnitOfWork;

    return yield* uow
      .run(
        Effect.gen(function* () {
          const userId = yield* identities.findBySubject(cmd.subject).pipe(
            Effect.map((identity) => identity.userId),
            // First sign-in for this subject: JIT provision an ordinary user.
            // Requires an email (the `users` row needs one); a verified
            // identity with no email can't be provisioned. The provisioning
            // command runs in this same transaction.
            Effect.catchTag("AuthIdentityNotFound", () =>
              Effect.gen(function* () {
                if (cmd.email === null) {
                  return yield* Effect.fail(
                    new CustomHttpApiError.Unauthorized({
                      message: "Cannot provision a user: the identity has no email.",
                    }),
                  );
                }
                const newUserId = yield* provisioning.provision(cmd.email).pipe(
                  Effect.catchTag("UserProvisioningConflict", (e) =>
                    Effect.fail(
                      new CustomHttpApiError.Unauthorized({
                        message: `Cannot provision a user: email ${e.email} is already registered.`,
                      }),
                    ),
                  ),
                );
                yield* identities.insert({
                  subject: cmd.subject,
                  userId: newUserId,
                  provider: "zitadel",
                });
                return newUserId;
              }),
            ),
          );

          const id = SessionId.make(yield* Effect.sync(() => crypto.randomUUID()));
          const now = yield* DateTime.now;
          const session = Session.create({
            id,
            userId,
            subject: cmd.subject,
            now,
            ttlSeconds: cmd.ttlSeconds,
            absoluteTtlSeconds: cmd.absoluteTtlSeconds,
          });
          yield* sessions.insert(session);
          yield* Effect.annotateCurrentSpan("user.id", userId);
          return { sessionId: id, userId };
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
  });
