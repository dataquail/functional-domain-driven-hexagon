import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { makeIsTodoSuperAdmin } from "@/modules/todos/policies/is-todo-super-admin.policy.js";
import { UserId } from "@/platform/ids/user-id.js";

const userId = UserId.make("11111111-1111-1111-1111-111111111111");
const caller = { sessionId: "s", userId };

describe("makeIsTodoSuperAdmin", () => {
  it.effect("returns true when the role module reports the caller is a super admin", () =>
    Effect.map(
      makeIsTodoSuperAdmin({ isSuperAdmin: () => Effect.succeed(true) })(caller),
      (result) => {
        deepStrictEqual(result, true);
      },
    ),
  );

  it.effect("returns false for an ordinary caller", () =>
    Effect.map(
      makeIsTodoSuperAdmin({ isSuperAdmin: () => Effect.succeed(false) })(caller),
      (result) => {
        deepStrictEqual(result, false);
      },
    ),
  );

  it.effect("asks about the calling user", () => {
    const seen: Array<UserId> = [];
    return Effect.map(
      makeIsTodoSuperAdmin({
        isSuperAdmin: (asked) => {
          seen.push(asked);
          return Effect.succeed(false);
        },
      })(caller),
      () => {
        deepStrictEqual(seen, [userId]);
      },
    );
  });
});
