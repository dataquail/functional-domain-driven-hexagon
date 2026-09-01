import { deepStrictEqual, ok } from "node:assert";

import { describe, it } from "@effect/vitest";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { Api } from "@/platform/api.js";
import { MEMBER_CALLER_ID } from "@/test-utils/fake-auth-middleware.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const NameRow = Schema.Struct({ name: Schema.String });
const MembershipCountRow = Schema.Struct({ user_id: Schema.String.check(Schema.isGUID()) });

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
        const { id } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });
        ok(typeof id === "string" && id.length > 0);

        const sql = yield* Database.Database;
        const orgRows = yield* sql`
              SELECT name FROM "organization".organizations WHERE id = ${id}
            `
          .pipe(Database.rows(NameRow))
          .pipe(Effect.orDie);
        deepStrictEqual(
          orgRows.map((r) => r.name),
          ["Acme"],
        );

        const memberRows = yield* sql`
              SELECT user_id FROM "organization".memberships WHERE organization_id = ${id}
            `
          .pipe(Database.rows(MembershipCountRow))
          .pipe(Effect.orDie);
        deepStrictEqual(
          memberRows.map((r) => r.user_id),
          [MEMBER_CALLER_ID],
        );
      }),
    );
  });
});
