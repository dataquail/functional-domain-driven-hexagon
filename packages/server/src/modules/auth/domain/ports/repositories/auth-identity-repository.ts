import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type AuthIdentityNotFound } from "@/modules/auth/domain/session-errors.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type UserId } from "@/platform/ids/user-id.js";

export type AuthIdentity = {
  readonly subject: string;
  readonly userId: UserId;
  readonly provider: string;
};

export type AuthIdentityRepositoryShape = {
  readonly findBySubject: (
    subject: string,
  ) => Effect.Effect<AuthIdentity, AuthIdentityNotFound | PersistenceUnavailable>;
  // Links a verified external subject to an app user. Used by JIT
  // provisioning on first OIDC sign-in. Joins the caller's transaction.
  readonly insert: (identity: AuthIdentity) => Effect.Effect<void, PersistenceUnavailable>;
};

export class AuthIdentityRepository extends Context.Tag("AuthIdentityRepository")<
  AuthIdentityRepository,
  AuthIdentityRepositoryShape
>() {}
