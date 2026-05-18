import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";

import { type PersistenceUnavailable } from "@/platform/ddd/persistence-unavailable.js";
import { type UserId } from "@/platform/ids/user-id.js";

import { type User } from "./user.aggregate.js";
import { type UserAlreadyExists, type UserNotFound } from "./user-errors.js";

// Every method's error channel includes `PersistenceUnavailable` so the
// transient-store signal can flow from the live repo through to the
// endpoint, which maps it to a 503. The shared-kernel port name keeps
// the domain free of any specific storage technology — the live
// implementation translates `@org/database`'s `DatabaseUnavailable` into
// this abstract port-level error at the boundary. Fakes never produce
// this at runtime but match the channel for type compatibility.
export type UserRepositoryShape = {
  readonly insert: (user: User) => Effect.Effect<void, UserAlreadyExists | PersistenceUnavailable>;
  readonly update: (user: User) => Effect.Effect<void, UserNotFound | PersistenceUnavailable>;
  readonly remove: (id: UserId) => Effect.Effect<void, UserNotFound | PersistenceUnavailable>;
  readonly findById: (id: UserId) => Effect.Effect<User, UserNotFound | PersistenceUnavailable>;
  readonly findByEmail: (
    email: string,
  ) => Effect.Effect<Option.Option<User>, PersistenceUnavailable>;
};

export class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  UserRepositoryShape
>() {}
