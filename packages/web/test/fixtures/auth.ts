// Auth fixtures for the integration tier. Mirrors `AuthContract` —
// `/auth/me` returns `CurrentUserResponse` for authenticated users.

import * as AuthContract from "@org/contracts/api/AuthContract";
import { UserId } from "@org/contracts/EntityIds";
import type { Permission } from "@org/contracts/Policy";

const DEFAULT_USER_ID = UserId.make("11111111-1111-1111-1111-111111111111");

/** A `CurrentUserResponse` — what `/auth/me` returns when signed in. */
export const makeCurrentUser = (
  overrides: Partial<{ userId: UserId; permissions: ReadonlyArray<Permission> }> = {},
): AuthContract.CurrentUserResponse =>
  new AuthContract.CurrentUserResponse({
    userId: overrides.userId ?? DEFAULT_USER_ID,
    permissions: overrides.permissions ?? [],
  });
