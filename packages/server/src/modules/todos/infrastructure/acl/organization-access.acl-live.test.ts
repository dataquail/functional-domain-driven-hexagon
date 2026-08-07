import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationQueries } from "@/modules/organization/index.js";
import { OrganizationAccess } from "@/modules/todos/domain/ports/acl/organization-access.acl.js";
import { OrganizationAccessLive } from "@/modules/todos/infrastructure/acl/organization-access.acl-live.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// `OrganizationAccessLive` asks the organization module its own membership question
// through that module's dispatch surface. Todos never reaches the org module's memberships
// directly — this adapter is the only place that vocabulary appears. The tags this adapter
// must never reach are wired to die rather than omitted, which is what makes "asks exactly
// one question" a property the test enforces.
const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");

const unreached = (tag: string) => () => Effect.die(`unexpected query ${tag}`);

const stubOrganizationQueries = (
  isMember: boolean,
  seen: Array<{ userId: UserId; orgId: OrganizationId }>,
) =>
  Layer.succeed(
    OrganizationQueries,
    OrganizationQueries.of({
      FindMembershipQuery: (payload) => {
        seen.push({ userId: payload.userId, orgId: payload.organizationId });
        return Effect.succeed({ isMember });
      },
      FindUserOrganizationRolesQuery: unreached("FindUserOrganizationRolesQuery"),
      FindOrganizationMembershipsQuery: unreached("FindOrganizationMembershipsQuery"),
      FindAllOrganizationsQuery: unreached("FindAllOrganizationsQuery"),
      FindMyOrganizationsQuery: unreached("FindMyOrganizationsQuery"),
      FindOrganizationByIdQuery: unreached("FindOrganizationByIdQuery"),
      FindPendingInvitationsQuery: unreached("FindPendingInvitationsQuery"),
    }),
  );

const testLayer = (isMember: boolean, seen: Array<{ userId: UserId; orgId: OrganizationId }>) =>
  OrganizationAccessLive.pipe(Layer.provide(stubOrganizationQueries(isMember, seen)));

describe("OrganizationAccessLive", () => {
  it.effect(
    "asks the organization module about the (user, org) pair and returns its answer",
    () => {
      const seen: Array<{ userId: UserId; orgId: OrganizationId }> = [];
      return Effect.gen(function* () {
        const access = yield* OrganizationAccess;
        deepStrictEqual(yield* access.isMember(userId, orgId), true);
        deepStrictEqual(seen, [{ userId, orgId }]);
      }).pipe(Effect.provide(testLayer(true, seen)));
    },
  );

  it.effect("returns false when the organization module reports non-membership", () => {
    const seen: Array<{ userId: UserId; orgId: OrganizationId }> = [];
    return Effect.gen(function* () {
      const access = yield* OrganizationAccess;
      deepStrictEqual(yield* access.isMember(userId, orgId), false);
    }).pipe(Effect.provide(testLayer(false, seen)));
  });
});
