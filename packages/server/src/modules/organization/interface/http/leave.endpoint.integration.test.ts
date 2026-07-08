import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { Api } from "@/api.js";
import { SUPER_ADMIN_CALLER_ID } from "@/test-utils/fake-auth-middleware.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const suite = describe.sequential;

const ORG_ID = "11111111-1111-1111-1111-111111111111" as never;

const seedOrg = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((c) =>
      c.query(sql.unsafe`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${ORG_ID}, 'Acme', now(), now(), null)
      `),
    )
    .pipe(Effect.orDie);
});

const seedCallerMembership = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((c) =>
      c.query(sql.unsafe`
        INSERT INTO "organization".memberships (user_id, organization_id, created_at)
        VALUES (${SUPER_ADMIN_CALLER_ID}, ${ORG_ID}, now())
      `),
    )
    .pipe(Effect.orDie);
});

suite("POST /orgs/:orgId/leave (integration)", () => {
  const { run } = useServerTestRuntime(
    ["organization.memberships", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
  );

  it("removes the caller's membership", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        yield* seedCallerMembership;
        const client = yield* HttpApiClient.make(Api);

        yield* client.organization.leave({ path: { orgId: ORG_ID } });

        const after = yield* client.organization.findMembers({ path: { orgId: ORG_ID } });
        const stillMember = after.members.some((m) => m.userId === SUPER_ADMIN_CALLER_ID);
        deepStrictEqual(stillMember, false);
      }),
    );
  });

  it("returns 404 when the caller is not a member", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(client.organization.leave({ path: { orgId: ORG_ID } }));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          deepStrictEqual(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)._tag, "MembershipNotFoundError");
        }
      }),
    );
  });
});
