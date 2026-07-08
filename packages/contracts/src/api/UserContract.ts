import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema";
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
  email: Schema.String.pipe(Schema.isMinLength(3), Schema.isMaxLength(255)),
  country: Schema.String.pipe(Schema.isMinLength(2), Schema.isMaxLength(50)),
  street: Schema.String.pipe(Schema.isMinLength(2), Schema.isMaxLength(50)),
  postalCode: Schema.String.pipe(Schema.isMinLength(2), Schema.isMaxLength(10)),
}) {}

export class CreateUserResponse extends Schema.Class<CreateUserResponse>("CreateUserResponse")({
  id: UserId,
}) {}

export class FindUsersParams extends Schema.Class<FindUsersParams>("FindUsersParams")({
  page: Schema.NumberFromString.pipe(Schema.int(), Schema.isGreaterThanOrEqualTo(1)),
  pageSize: Schema.NumberFromString.pipe(Schema.int(), Schema.isBetween(1, 100)),
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
  // Group-wide: every endpoint here can 503 on transient DB failure. The
  // typed channel lets endpoint handlers `Effect.catchTag` the
  // `PersistenceUnavailable` use cases produce and surface the 503 to
  // the SPA without leaking infrastructure tags into the contract.
  .addError(CustomHttpApiError.ServiceUnavailable)
  .prefix("/users") {}
