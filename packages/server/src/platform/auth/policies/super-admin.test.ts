import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

import { UserId } from "@/platform/ids/user-id.js";
import { makeRoleServiceFake } from "@/test-utils/role-service-fake.js";

import { SuperAdminOnly } from "./super-admin.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const caller = { sessionId: "test", userId };

describe("SuperAdminOnly", () => {
  it.effect("returns true when RoleService reports super_admin", () =>
    SuperAdminOnly(caller, undefined).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          deepStrictEqual(result, true);
        }),
      ),
      Effect.provide(makeRoleServiceFake(new Map([[userId, ["super_admin"]]]))),
    ),
  );

  it.effect("returns false when RoleService reports no platform roles", () =>
    SuperAdminOnly(caller, undefined).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          deepStrictEqual(result, false);
        }),
      ),
      Effect.provide(makeRoleServiceFake(new Map())),
    ),
  );

  it.effect("ignores the resource argument entirely", () =>
    SuperAdminOnly(caller, { irrelevant: "value" }).pipe(
      Effect.tap((result) =>
        Effect.sync(() => {
          deepStrictEqual(result, true);
        }),
      ),
      Effect.provide(makeRoleServiceFake(new Map([[userId, ["super_admin"]]]))),
    ),
  );
});
