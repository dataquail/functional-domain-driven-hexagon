import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

import { Api } from "@/api.js";
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

suite("GET /orgs/:orgId/invitations (integration)", () => {
  const { run } = useServerTestRuntime(
    ["organization.invitations", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
  );

  it("lists open invitations as pending", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        // Seed via the production invite path, not raw SQL.
        yield* client.organization.inviteUser({
          path: { orgId: ORG_ID },
          payload: { email: "alice@example.com" },
        });

        const res = yield* client.organization.findInvitations({ path: { orgId: ORG_ID } });
        deepStrictEqual(res.invitations.length, 1);
        const invitation = res.invitations[0];
        if (invitation === undefined) throw new Error("expected one invitation");
        deepStrictEqual(invitation.inviteeEmail, "alice@example.com");
        deepStrictEqual(invitation.status, "pending");
      }),
    );
  });

  it("returns an empty list for an org with no invitations", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        const res = yield* client.organization.findInvitations({ path: { orgId: ORG_ID } });
        deepStrictEqual(res.invitations.length, 0);
      }),
    );
  });
});
