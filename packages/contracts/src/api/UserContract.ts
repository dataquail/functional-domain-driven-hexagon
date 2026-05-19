import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint";
import * as HttpApiGroup from "@effect/platform/HttpApiGroup";
import * as HttpApiSchema from "@effect/platform/HttpApiSchema";
import * as Schema from "effect/Schema";

import * as CustomHttpApiError from "../CustomHttpApiError.js";
import { UserId } from "../EntityIds.js";
import { UserAuthMiddleware } from "../Policy.js";

// ==========================================
// Errors
// ==========================================

export class UserAlreadyExistsError extends Schema.TaggedError<UserAlreadyExistsError>(
  "UserAlreadyExistsError",
)(
  "UserAlreadyExistsError",
  {
    email: Schema.String,
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 409 }),
) {}

export class UserNotFoundError extends Schema.TaggedError<UserNotFoundError>("UserNotFoundError")(
  "UserNotFoundError",
  {
    userId: UserId,
    message: Schema.String,
  },
  HttpApiSchema.annotations({ status: 404 }),
) {}

// ==========================================
// Shapes
// ==========================================

export const Address = Schema.Struct({
  country: Schema.String,
  street: Schema.String,
  postalCode: Schema.String,
});
export type Address = typeof Address.Type;

export class User extends Schema.Class<User>("User")({
  id: UserId,
  email: Schema.String,
  isSuperAdmin: Schema.Boolean,
  address: Address,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}

// ==========================================
// Payloads / Responses
// ==========================================

export class CreateUserPayload extends Schema.Class<CreateUserPayload>("CreateUserPayload")({
  email: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(255)),
  country: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(50)),
  street: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(50)),
  postalCode: Schema.String.pipe(Schema.minLength(2), Schema.maxLength(10)),
}) {}

export class CreateUserResponse extends Schema.Class<CreateUserResponse>("CreateUserResponse")({
  id: UserId,
}) {}

export class FindUsersParams extends Schema.Class<FindUsersParams>("FindUsersParams")({
  page: Schema.NumberFromString.pipe(Schema.int(), Schema.greaterThanOrEqualTo(1)),
  pageSize: Schema.NumberFromString.pipe(Schema.int(), Schema.between(1, 100)),
}) {}

export class PaginatedUsers extends Schema.Class<PaginatedUsers>("PaginatedUsers")({
  users: Schema.Array(User),
  page: Schema.Number,
  pageSize: Schema.Number,
  total: Schema.Number,
}) {}

// ==========================================
// Endpoints
// ==========================================

export class Group extends HttpApiGroup.make("user")
  .middleware(UserAuthMiddleware)
  .add(HttpApiEndpoint.get("find", "/").setUrlParams(FindUsersParams).addSuccess(PaginatedUsers))
  .add(
    HttpApiEndpoint.post("create", "/")
      .setPayload(CreateUserPayload)
      .addSuccess(CreateUserResponse)
      .addError(UserAlreadyExistsError),
  )
  .add(
    HttpApiEndpoint.del("delete", "/:id")
      .setPath(Schema.Struct({ id: UserId }))
      .addSuccess(Schema.Void)
      .addError(UserNotFoundError),
  )
  .add(
    HttpApiEndpoint.post("promoteToSuperAdmin", "/:id/super-admin")
      .setPath(Schema.Struct({ id: UserId }))
      .addSuccess(Schema.Void)
      .addError(UserNotFoundError),
  )
  .add(
    HttpApiEndpoint.del("demoteFromSuperAdmin", "/:id/super-admin")
      .setPath(Schema.Struct({ id: UserId }))
      .addSuccess(Schema.Void)
      .addError(UserNotFoundError),
  )
  // Group-wide: every endpoint here can 503 on transient DB failure. The
  // typed channel lets endpoint handlers `Effect.catchTag` the
  // `PersistenceUnavailable` use cases produce and surface the 503 to
  // the SPA without leaking infrastructure tags into the contract.
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/users") {}
