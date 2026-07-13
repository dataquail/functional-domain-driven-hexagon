import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";

import {
  type UserAlreadyExists,
  type UserNotFound,
} from "@/modules/user/domain/user/user.errors.js";
import { type UserRoot } from "@/modules/user/domain/user/user.root.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type Specification } from "@/platform/ddd/contracts/specification.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Dumb persistence, collapsed to the minimal vocabulary: insert/update/delete
// the aggregate, and read it back by a Specification. Identity and natural-key
// lookups — by id, by email — are expressed as a spec at the call site (see
// UserSpecifications) and compiled to a WHERE fragment by the live repository.
// Absence is a plain `null`; mapping it to a domain 404 (UserNotFound) is the
// caller's job. Every method's error channel includes `PersistenceUnavailable`
// so the transient-store signal can flow from the live repo through to the
// endpoint, which maps it to a 503; the live implementation translates
// `@org/database`'s `DatabaseUnavailable` into this abstract port-level error
// at the boundary. Fakes never produce it at runtime but match the channel.
export type UserRepositoryShape = {
  readonly insertOne: (
    user: UserRoot,
  ) => Effect.Effect<void, UserAlreadyExists | PersistenceUnavailable>;
  readonly updateOne: (
    user: UserRoot,
  ) => Effect.Effect<void, UserNotFound | PersistenceUnavailable>;
  readonly deleteOne: (id: UserId) => Effect.Effect<void, UserNotFound | PersistenceUnavailable>;
  readonly findOne: (
    spec: Specification<UserRoot>,
  ) => Effect.Effect<UserRoot | null, PersistenceUnavailable>;
};

export class UserRepository extends Context.Service<UserRepository, UserRepositoryShape>()(
  "UserRepository",
) {}
