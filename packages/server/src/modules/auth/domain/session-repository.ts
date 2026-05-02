import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import { type SessionNotFound, type SessionRevoked } from "./session-errors.js";
import { type SessionId } from "./session-id.js";
import { type Session } from "./session.aggregate.js";

export type SessionRepositoryShape = {
  readonly insert: (session: Session) => Effect.Effect<void>;
  readonly findById: (id: SessionId) => Effect.Effect<Session, SessionNotFound>;
  readonly revoke: (id: SessionId) => Effect.Effect<void, SessionNotFound | SessionRevoked>;
  readonly update: (session: Session) => Effect.Effect<void, SessionNotFound>;
};

export class SessionRepository extends Context.Tag("SessionRepository")<
  SessionRepository,
  SessionRepositoryShape
>() {}
