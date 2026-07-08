import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import * as Schema from "effect/Schema";

import * as CustomHttpApiError from "../CustomHttpApiError.js";
import { UserId } from "../EntityIds.js";
import { UserAuthMiddleware } from "../Policy.js";

// ==========================================
// Errors
// ==========================================

export class UserAlreadyExistsError extends Schema.TaggedErrorClass<UserAlreadyExistsError>(
  "UserAlreadyExistsError",
)(
  "UserAlreadyExistsError",
  {
    email: Schema.String,
    message: Schema.String,
  },
  { httpApiStatus: 409 },
) {}

export class UserNotFoundError extends Schema.TaggedErrorClass<UserNotFoundError>("UserNotFoundError")(
  "UserNotFoundError",
  {
    userId: UserId,
    message: Schema.String,
  },
  { httpApiStatus: 404 },
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
  // Nullable: a user provisioned just-in-time on first OIDC sign-in has no
  // address until they fill it in.
  address: Schema.NullOr(Address),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}

// ==========================================
// Payloads / Responses
// ==========================================

export class CreateUserPayload extends Schema.Class<CreateUserPayload>("CreateUserPayload")({
  email: Schema.String.check(Schema.isMinLength(3), Schema.isMaxLength(255)),
  country: Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(50)),
  street: Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(50)),
  postalCode: Schema.String.check(Schema.isMinLength(2), Schema.isMaxLength(10)),
}) {}

export class CreateUserResponse extends Schema.Class<CreateUserResponse>("CreateUserResponse")({
  id: UserId,
}) {}

export class FindUsersParams extends Schema.Class<FindUsersParams>("FindUsersParams")({
  page: Schema.NumberFromString.check(Schema.isInt(), Schema.isGreaterThanOrEqualTo(1)),
  pageSize: Schema.NumberFromString.check(Schema.isInt(), Schema.isBetween({ minimum: 1, maximum: 100 })),
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
  .add(
    HttpApiEndpoint.get("find", "/", {
      query: FindUsersParams,
      success: PaginatedUsers,
      error: CustomHttpApiError.ServiceUnavailable,
    }),
  )
  .add(
    HttpApiEndpoint.post("create", "/", {
      payload: CreateUserPayload,
      success: CreateUserResponse,
      error: [UserAlreadyExistsError, CustomHttpApiError.ServiceUnavailable],
    }),
  )
  .add(
    HttpApiEndpoint.make("DELETE")("delete", "/:id", {
      params: Schema.Struct({ id: UserId }),
      success: Schema.Void,
      error: [UserNotFoundError, CustomHttpApiError.ServiceUnavailable],
    }),
  )
  // Group-wide: every endpoint here can 503 on transient DB failure. The
  // typed channel lets endpoint handlers `Effect.catchTag` the
  // `PersistenceUnavailable` use cases produce and surface the 503 to
  // the SPA without leaking infrastructure tags into the contract.
  .middleware(UserAuthMiddleware)
  .prefix("/users") {}
