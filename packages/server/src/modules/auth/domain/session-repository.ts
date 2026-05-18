import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";

import { type Session } from "./session.aggregate.js";
import { type SessionNotFound, type SessionRevoked } from "./session-errors.js";
import { type SessionId } from "./session-id.js";

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
