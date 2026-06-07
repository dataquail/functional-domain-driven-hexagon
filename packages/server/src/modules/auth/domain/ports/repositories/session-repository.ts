import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type Session } from "@/modules/auth/domain/session.aggregate.js";
import { type SessionNotFound, type SessionRevoked } from "@/modules/auth/domain/session-errors.js";
import { type SessionId } from "@/modules/auth/domain/session-id.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";

export type SessionRepositoryShape = {
  readonly insert: (session: Session) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findById: (
    id: SessionId,
  ) => Effect.Effect<Session, SessionNotFound | PersistenceUnavailable>;
  // Soft-deletes the session by stamping `revoked_at`. Named after the
  // collection operation, not the business meaning ("revoke" is a
  // use-case concern — see `RevokeSessionCommand`). Repository ports
  // stay dumb (per `feedback_dumb_repositories`); the storage
  // mechanism (soft-delete via UPDATE so the audit row survives) is
  // an implementation detail. `SessionRevoked` is reserved for the
  // already-soft-deleted case so the caller can preserve the original
  // `revoked_at` timestamp.
  readonly delete: (
    id: SessionId,
  ) => Effect.Effect<void, SessionNotFound | SessionRevoked | PersistenceUnavailable>;
  readonly update: (
    session: Session,
  ) => Effect.Effect<void, SessionNotFound | PersistenceUnavailable>;
};

export class SessionRepository extends Context.Tag("SessionRepository")<
  SessionRepository,
  SessionRepositoryShape
>() {}
