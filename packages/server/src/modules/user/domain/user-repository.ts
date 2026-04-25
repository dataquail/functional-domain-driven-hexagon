import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type * as Option from "effect/Option";
import { type UserAlreadyExists, type UserNotFound } from "./user-errors.js";
import { type UserId } from "./user-id.js";
import { type User } from "./user.aggregate.js";

export type UserRepositoryShape = {
  readonly insert: (user: User) => Effect.Effect<void, UserAlreadyExists>;
  readonly update: (user: User) => Effect.Effect<void, UserNotFound>;
  readonly remove: (id: UserId) => Effect.Effect<void, UserNotFound>;
  readonly findById: (id: UserId) => Effect.Effect<User, UserNotFound>;
  readonly findByEmail: (email: string) => Effect.Effect<Option.Option<User>>;
};

export class UserRepository extends Context.Tag("UserRepository")<
  UserRepository,
  UserRepositoryShape
>() {}
