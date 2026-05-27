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
  readonly revoke: (
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
