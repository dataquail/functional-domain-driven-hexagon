import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { UsersLookup } from "@/modules/organization/domain/ports/acl/users-lookup.acl.js";
import { UsersLookupLive } from "@/modules/organization/infrastructure/acl/users-lookup.acl-live.js";
import { UserQueries } from "@/modules/user/index.js";
import { UserId } from "@/platform/ids/user-id.js";

// `UsersLookupLive` is a thin translation over the user module's dispatch surface: its
// job is to map that module's `FindUsersUserView[]` into the `UserLookupView[]` shape
// the org module owns, dropping every field the org module has no business seeing.
const userA = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const userB = UserId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const seededAt = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));

const stubUserQueries = Layer.succeed(
  UserQueries,
  UserQueries.of({
    FindUsersQuery: () => Effect.die("unexpected FindUsersQuery"),
    FindUsersByIdsQuery: ({ ids }) =>
      Effect.succeed(
        ids.map((id) => ({
          id,
          email: `${id}@example.com`,
          address: { country: "N/A", street: "N/A", postalCode: "N/A" },
          createdAt: seededAt,
          updatedAt: seededAt,
        })),
      ),
  }),
);

const TestLayer = UsersLookupLive.pipe(Layer.provide(stubUserQueries));

describe("UsersLookupLive", () => {
  it.effect("maps each user id to a {userId, email} view in input order", () =>
    Effect.gen(function* () {
      const lookup = yield* UsersLookup;
      const result = yield* lookup.findByIds([userA, userB]);
      deepStrictEqual(result, [
        { userId: userA, email: `${userA}@example.com` },
        { userId: userB, email: `${userB}@example.com` },
      ]);
    }).pipe(Effect.provide(TestLayer)),
  );
});
