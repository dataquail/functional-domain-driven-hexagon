import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { Query } from "@effect-server-utils/cqrs";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationAccess } from "@/modules/billing/domain/ports/acl/organization-access.acl.js";
import { OrganizationAccessLive } from "@/modules/billing/infrastructure/acl/organization-access.acl-live.js";
import { organizationAccessQueries } from "@/modules/organization/organization.exports.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// Billing asks the organization module two questions — "is this caller a
// member?" (read the subscription) and "is this caller an org admin?" (take on a
// financial commitment). One port, two methods, because both answers come from
// the same upstream module.
const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");

// The organization module's dispatch surface is a plain object of typed methods, so
// standing in for it needs no cast. The tags this adapter must never reach are wired to
// property the surface itself now enforces: the two queries below are the whole of
// what organization publishes, so a third question would not type-check.
const stubOrganizationQueries = (opts: {
  readonly isMember?: boolean;
  readonly roles?: ReadonlyArray<string>;
}) =>
  Query.handlersOf(organizationAccessQueries, {
    FindMembershipQuery: () => Effect.succeed({ isMember: opts.isMember ?? false }),
    FindUserOrganizationRolesQuery: (payload) =>
      Effect.succeed({
        userId: payload.userId,
        organizationId: payload.organizationId,
        roles: opts.roles ?? [],
      }),
  });

const testLayer = (opts: { readonly isMember?: boolean; readonly roles?: ReadonlyArray<string> }) =>
  OrganizationAccessLive.pipe(Layer.provide(stubOrganizationQueries(opts)));

describe("OrganizationAccessLive (billing)", () => {
  it.effect("isMember reflects the organization module's membership answer", () =>
    Effect.gen(function* () {
      const access = yield* OrganizationAccess;
      deepStrictEqual(yield* access.isMember(userId, orgId), true);
    }).pipe(Effect.provide(testLayer({ isMember: true }))),
  );

  it.effect("isMember is false for a non-member", () =>
    Effect.gen(function* () {
      const access = yield* OrganizationAccess;
      deepStrictEqual(yield* access.isMember(userId, orgId), false);
    }).pipe(Effect.provide(testLayer({ isMember: false }))),
  );

  it.effect("isAdmin narrows the org's role list to the admin role", () =>
    Effect.gen(function* () {
      const access = yield* OrganizationAccess;
      deepStrictEqual(yield* access.isAdmin(userId, orgId), true);
    }).pipe(Effect.provide(testLayer({ roles: ["admin"] }))),
  );

  it.effect("isAdmin is false when the caller holds no org roles", () =>
    Effect.gen(function* () {
      const access = yield* OrganizationAccess;
      deepStrictEqual(yield* access.isAdmin(userId, orgId), false);
    }).pipe(Effect.provide(testLayer({ roles: [] }))),
  );

  it.effect("isAdmin is false for a non-admin org role", () =>
    Effect.gen(function* () {
      const access = yield* OrganizationAccess;
      deepStrictEqual(yield* access.isAdmin(userId, orgId), false);
    }).pipe(Effect.provide(testLayer({ roles: ["billing_viewer"] }))),
  );

  it.effect("a member who is not an admin may read but not mutate", () =>
    Effect.gen(function* () {
      const access = yield* OrganizationAccess;
      deepStrictEqual(yield* access.isMember(userId, orgId), true);
      deepStrictEqual(yield* access.isAdmin(userId, orgId), false);
    }).pipe(Effect.provide(testLayer({ isMember: true, roles: [] }))),
  );
});
