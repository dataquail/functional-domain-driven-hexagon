import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable.ts";
import { type Specification } from "@/globals/application/ddd/specification.ts";
import {
  type SessionNotFound,
  type SessionRevoked,
} from "@/modules/auth/domain/session/session.errors.ts";
import { type SessionId } from "@/modules/auth/domain/session/session.id.ts";
import { type SessionRoot } from "@/modules/auth/domain/session/session.root.ts";

// Dumb persistence: insert/update the aggregate, soft-delete by id, and read
// it back by a Specification. The identity lookup is expressed as a spec at the
// call site (SessionSpecifications.withId) and compiled to a WHERE fragment by
// the live repository. Absence is `Option.none()`; mapping it to a domain 404
// (SessionNotFound) is the caller's job.
export type SessionRepositoryService = {
  readonly insertOne: (session: SessionRoot) => Effect.Effect<void, PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<SessionRoot>,
  ) => Effect.Effect<Option.Option<SessionRoot>, PersistenceUnavailable>;
  // Soft-deletes the session by stamping `revoked_at`. Named after the
  // collection operation, not the business meaning ("revoke" is a
  // use-case concern — see `RevokeSessionCommand`). Repository ports
  // stay dumb (per `feedback_dumb_repositories`); the storage
  // mechanism (soft-delete via UPDATE so the audit row survives) is
  // an implementation detail. `SessionRevoked` is reserved for the
  // already-soft-deleted case so the caller can preserve the original
  // `revoked_at` timestamp.
  readonly deleteOne: (
    id: SessionId,
  ) => Effect.Effect<void, SessionNotFound | SessionRevoked | PersistenceUnavailable>;
  readonly updateOne: (
    session: SessionRoot,
  ) => Effect.Effect<void, SessionNotFound | PersistenceUnavailable>;
};

export class SessionRepository extends Context.Service<
  SessionRepository,
  SessionRepositoryService
>()("SessionRepository") {}
