import { type SignInCommand, type SignInOutput } from "@/modules/auth/commands/sign-in-command.js";
import { AuthIdentityRepository } from "@/modules/auth/domain/auth-identity-repository.js";
import { SessionId } from "@/modules/auth/domain/session-id.js";
import { SessionRepository } from "@/modules/auth/domain/session-repository.js";
import * as Session from "@/modules/auth/domain/session.aggregate.js";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

// Slice-scope SignIn:
//   - looks up auth_identities by Zitadel subject
//   - admins are pre-seeded by infra/zitadel/seed.mjs, so the row exists
//   - non-admin JIT provisioning is deferred (plan §3.6 evolution path)
//   - creates and persists a Session, returns its id
//
// Bus-boundary span (ADR-0012) wraps this at dispatch time, so no inline
// `withSpan` here.
export const signIn = (cmd: SignInCommand): SignInOutput =>
  Effect.gen(function* () {
    const identities = yield* AuthIdentityRepository;
    const repo = yield* SessionRepository;

    const identity = yield* identities.findBySubject(cmd.subject).pipe(
      Effect.catchTag("AuthIdentityNotFound", () =>
        Effect.fail(
          new CustomHttpApiError.Unauthorized({
            message: "No app user is provisioned for this identity yet.",
          }),
        ),
      ),
    );

    const id = SessionId.make(yield* Effect.sync(() => crypto.randomUUID()));
    const now = yield* DateTime.now;
    const session = Session.create({
      id,
      userId: identity.userId,
      subject: cmd.subject,
      now,
      ttlSeconds: cmd.ttlSeconds,
      absoluteTtlSeconds: cmd.absoluteTtlSeconds,
    });
    yield* repo.insert(session);
    yield* Effect.annotateCurrentSpan("user.id", identity.userId);
    return { sessionId: id, userId: identity.userId };
  });
