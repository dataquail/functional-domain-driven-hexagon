import { deepStrictEqual } from "node:assert";

import { assertDefined } from "@effect/vitest/utils";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import { OrganizationId } from "@org/contracts/EntityIds";
import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";

import { Api } from "@/globals/infrastructure/framework/http/api.ts";
import { describeServer } from "@/test-utils/server-test-runtime.ts";

const ORG_ID = OrganizationId.make("11111111-1111-1111-1111-111111111111");

const seedOrg = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${ORG_ID}, 'Acme', now(), now(), null)
      `.pipe(Effect.orDie);
});

describeServer(
  "GET /orgs/:orgId/invitations (integration)",
  {
    tables: [
      "organization.invitations",
      "organization.organizations",
      "platform.roles",
      "user.users",
    ],
    seedSuperAdminCaller: true,
  },
  (it) => {
    it.effect("lists open invitations as pending", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        // Seed via the production invite path, not raw SQL.
        yield* client.organization.inviteUser({
          params: { orgId: ORG_ID },
          payload: new OrganizationContract.InviteUserPayload({ email: "alice@example.com" }),
        });

        const res = yield* client.organization.findInvitations({ params: { orgId: ORG_ID } });
        deepStrictEqual(res.invitations.length, 1);
        const invitation = res.invitations[0];

        assertDefined(invitation);
        deepStrictEqual(invitation.inviteeEmail, "alice@example.com");
        deepStrictEqual(invitation.status, "pending");
      }),
    );

    it.effect("returns an empty list for an org with no invitations", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        const res = yield* client.organization.findInvitations({ params: { orgId: ORG_ID } });
        deepStrictEqual(res.invitations.length, 0);
      }),
    );
  },
);
