import { describe, it } from "@effect/vitest";
import { Database } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationAccess } from "@/modules/todos/domain/ports/acl/organization-access.acl.js";
import { OrganizationAccessLive } from "@/modules/todos/infrastructure/acl/organization-access.acl-live.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { UserId } from "@/platform/ids/user-id.js";

// `OrganizationAccessLive` asks the organization module its own membership
// question through the bus. Todos never reaches the org module's memberships
// directly — this adapter is the only place that vocabulary appears.
const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const orgId = OrganizationId.make("22222222-2222-2222-2222-222222222222");

const stubQueryBus = (isMember: boolean, seen: Array<{ userId: UserId; orgId: OrganizationId }>) =>
  Layer.succeed(
    QueryBus,
    QueryBus.of({
      execute: ((query: { _tag: string; userId: UserId; organizationId: OrganizationId }) => {
        if (query._tag !== "FindMembershipQuery") {
          return Effect.die(`unexpected query ${query._tag}`);
        }
        seen.push({ userId: query.userId, orgId: query.organizationId });
        return Effect.succeed({ isMember });
      }) as never,
    }),
  );

const stubDatabase = Layer.succeed(Database.Database, {} as Database.Database["Service"]);

const testLayer = (isMember: boolean, seen: Array<{ userId: UserId; orgId: OrganizationId }>) =>
  OrganizationAccessLive.pipe(
    Layer.provide(stubQueryBus(isMember, seen)),
    Layer.provide(stubDatabase),
  );

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
