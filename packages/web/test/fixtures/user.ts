// User fixtures for the integration tier. Each factory returns a
// contract-shape object with sensible defaults so tests can override
// only the fields they care about. The drift gate is the sibling test:
// each fixture's default output must decode through the contract's
// response schema.

import * as UserContract from "@org/contracts/api/UserContract";
import { UserId } from "@org/contracts/EntityIds";
import * as DateTime from "effect/DateTime";

const FIXED_DATE = DateTime.unsafeMake(new Date("2026-01-01T00:00:00Z"));

const DEFAULT_USER_ID = UserId.make("11111111-1111-1111-1111-111111111111");

/** A valid `UserContract.User` with overridable fields. */
export const makeUser = (overrides: Partial<UserContract.User> = {}): UserContract.User =>
  new UserContract.User({
    id: DEFAULT_USER_ID,
    email: "alice@example.com",
    role: "guest",
    address: { country: "US", street: "1 A St", postalCode: "10001" },
    createdAt: FIXED_DATE,
    updatedAt: FIXED_DATE,
    ...overrides,
  });

/** A `PaginatedUsers` page; `users` defaults to a single `makeUser()`. */
export const makePaginatedUsers = (
  overrides: Partial<UserContract.PaginatedUsers> = {},
): UserContract.PaginatedUsers => {
  const users = overrides.users ?? [makeUser()];
  return new UserContract.PaginatedUsers({
    users,
    page: 1,
    pageSize: 10,
    total: users.length,
    ...overrides,
  });
};

/** A valid `CreateUserPayload` — the shape an admin would submit. */
export const makeCreateUserPayload = (
  overrides: Partial<UserContract.CreateUserPayload> = {},
): UserContract.CreateUserPayload =>
  new UserContract.CreateUserPayload({
    email: "new-user@example.com",
    country: "US",
    street: "2 B St",
    postalCode: "10002",
    ...overrides,
  });
