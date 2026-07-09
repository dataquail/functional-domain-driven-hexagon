import { describe, it } from "@effect/vitest";
import { Database } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { UsersLookup } from "@/modules/organization/domain/ports/acl/users-lookup.acl.js";
import { UsersLookupLive } from "@/modules/organization/infrastructure/acl/users-lookup.acl-live.js";
import { QueryBus } from "@/platform/ddd/ports/query-bus.js";
import { UserId } from "@/platform/ids/user-id.js";

// `UsersLookupLive` is a thin translation over the QueryBus — its job
// is to map the user-module's `FindUsersUserView[]` into the
// `UserLookupView[]` shape the org module owns. We stub the QueryBus
// + a no-op Database (the Live captures Database to re-provide it to
// the bus-dispatched effect; the stub QueryBus ignores it).
const userA = UserId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const userB = UserId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

const stubQueryBus = Layer.succeed(
  QueryBus,
  QueryBus.of({
    execute: ((query: { _tag: string; ids: ReadonlyArray<UserId> }) =>
      query._tag === "FindUsersByIdsQuery"
        ? Effect.succeed(
            query.ids.map((id) => ({
              id,
              email: `${id}@example.com`,
              address: { country: "N/A", street: "N/A", postalCode: "N/A" },
              createdAt: undefined,
              updatedAt: undefined,
            })),
          )
        : Effect.die(`unexpected query ${query._tag}`)) as never,
  }),
);

// The Live re-provides Database to the bus-dispatched effect; our
// stub bus doesn't actually use it, so an opaque placeholder is fine.
const stubDatabase = Layer.succeed(Database.Database, {} as Database.Database["Service"]);

const TestLayer = UsersLookupLive.pipe(Layer.provide(stubQueryBus), Layer.provide(stubDatabase));

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
