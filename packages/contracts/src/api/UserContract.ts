import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint";
import * as HttpApiGroup from "@effect/platform/HttpApiGroup";
import * as HttpApiSchema from "@effect/platform/HttpApiSchema";
import * as Schema from "effect/Schema";
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

export const UserRole = Schema.Literal("admin", "moderator", "guest");
export type UserRole = typeof UserRole.Type;

export const PromotableRole = Schema.Literal("admin", "moderator");
export type PromotableRole = typeof PromotableRole.Type;

export const Address = Schema.Struct({
  country: Schema.String,
  street: Schema.String,
  postalCode: Schema.String,
});
export type Address = typeof Address.Type;

export class User extends Schema.Class<User>("User")({
  id: UserId,
  email: Schema.String,
  role: UserRole,
  address: Address,
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}

// ==========================================
// Payloads / Responses
// ==========================================

export class CreateUserPayload extends Schema.Class<CreateUserPayload>("CreateUserPayload")({
  email: Schema.String.pipe(Schema.minLength(3), Schema.maxLength(255)),
  country: Schema.String,
  street: Schema.String,
  postalCode: Schema.String,
}) {}

export class CreateUserResponse extends Schema.Class<CreateUserResponse>("CreateUserResponse")({
  id: UserId,
}) {}

export class ChangeUserRolePayload extends Schema.Class<ChangeUserRolePayload>(
  "ChangeUserRolePayload",
)({
  role: PromotableRole,
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
    HttpApiEndpoint.put("changeRole", "/:id/role")
      .setPath(Schema.Struct({ id: UserId }))
      .setPayload(ChangeUserRolePayload)
      .addSuccess(Schema.Void)
      .addError(UserNotFoundError),
  )
  .prefix("/users") {}
