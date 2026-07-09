import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { Api } from "@/api.js";
import { MEMBER_CALLER_ID } from "@/test-utils/fake-auth-middleware.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const NameRowStd = Schema.toStandardSchemaV1(Schema.Struct({ name: Schema.String }));
const MembershipCountRowStd = Schema.toStandardSchemaV1(Schema.Struct({ user_id: Schema.String.check(Schema.isGUID()) }));

const suite = describe.sequential;

suite("POST /orgs (integration)", () => {
  // Super-admins can't own orgs (they're a disjoint user type), so org
  // creation runs as a regular member; the creator becomes the first member.
  const { run } = useServerTestRuntime(
    ["organization.memberships", "organization.organizations", "platform.roles", "user.users"],
    { server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  );

  it("creates an org, returns its id, and seeds the caller as the first Membership", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id } = yield* client.organization.create({ payload: { name: "Acme" } });
        ok(typeof id === "string" && id.length > 0);

        const db = yield* Database.Database;
        const orgRows = yield* db
          .execute((c) =>
            c.any(sql.type(NameRowStd)`
              SELECT name FROM "organization".organizations WHERE id = ${id}
            `),
          )
          .pipe(Effect.orDie);
        deepStrictEqual(
          orgRows.map((r) => r.name),
          ["Acme"],
        );

        const memberRows = yield* db
          .execute((c) =>
            c.any(sql.type(MembershipCountRowStd)`
              SELECT user_id FROM "organization".memberships WHERE organization_id = ${id}
            `),
          )
          .pipe(Effect.orDie);
        deepStrictEqual(
          memberRows.map((r) => r.user_id),
          [MEMBER_CALLER_ID],
        );
      }),
    );
  });
});
