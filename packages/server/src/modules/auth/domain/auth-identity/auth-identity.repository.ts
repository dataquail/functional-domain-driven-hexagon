import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import { type UserId } from "@/globals/application/ddd/ids/user-id.js";
import { type PersistenceUnavailable } from "@/globals/application/ddd/persistence-unavailable.js";
import { type Specification } from "@/globals/application/ddd/specification.js";

export type AuthIdentity = {
  readonly subject: string;
  readonly userId: UserId;
  readonly provider: string;
};

// Dumb persistence: link an external subject to an app user (insertOne) and
// read the linkage back by a Specification. The subject lookup is expressed as
// a spec at the call site (AuthIdentitySpecifications.bySubject); absence is a
// plain `null`, mapped to AuthIdentityNotFound (or JIT provisioning) by the
// caller.
export type AuthIdentityRepositoryShape = {
  readonly findOne: (
    spec: Specification<AuthIdentity>,
  ) => Effect.Effect<AuthIdentity | null, PersistenceUnavailable>;
  // Links a verified external subject to an app user. Used by JIT
  // provisioning on first OIDC sign-in. Joins the caller's transaction.
  readonly insertOne: (identity: AuthIdentity) => Effect.Effect<void, PersistenceUnavailable>;
};

export class AuthIdentityRepository extends Context.Service<
  AuthIdentityRepository,
  AuthIdentityRepositoryShape
>()("AuthIdentityRepository") {}
