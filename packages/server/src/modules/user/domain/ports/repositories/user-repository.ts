import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type User } from "@/modules/user/domain/user.aggregate.js";
import { type UserAlreadyExists, type UserNotFound } from "@/modules/user/domain/user-errors.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { type UserId } from "@/platform/ids/user-id.js";

// Every method's error channel includes `PersistenceUnavailable` so the
// transient-store signal can flow from the live repo through to the
// endpoint, which maps it to a 503. The shared-kernel port name keeps
// the domain free of any specific storage technology — the live
// implementation translates `@org/database`'s `DatabaseUnavailable` into
// this abstract port-level error at the boundary. Fakes never produce
// this at runtime but match the channel for type compatibility.
export type UserRepositoryShape = {
  readonly insertOne: (
    user: User,
  ) => Effect.Effect<void, UserAlreadyExists | PersistenceUnavailable>;
  readonly updateOne: (user: User) => Effect.Effect<void, UserNotFound | PersistenceUnavailable>;
  readonly deleteOne: (id: UserId) => Effect.Effect<void, UserNotFound | PersistenceUnavailable>;
  readonly findOneById: (id: UserId) => Effect.Effect<User, UserNotFound | PersistenceUnavailable>;
  readonly findOneByEmail: (
    email: string,
  ) => Effect.Effect<Option.Option<User>, PersistenceUnavailable>;
};

export class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  UserRepositoryShape
>() {}
