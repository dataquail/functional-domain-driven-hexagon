import { deepStrictEqual, ok } from "node:assert";

import { OrganizationContract } from "@org/contracts/api/Contracts";
import { InvitationId, OrganizationId } from "@org/contracts/EntityIds";
import { Database } from "@org/database/index";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Option from "effect/Option";

import { Api } from "@/globals/infrastructure/framework/http/api.js";
import { describeServer } from "@/test-utils/server-test-runtime.js";

const ORG_ID = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const UNKNOWN_INVITATION_ID = InvitationId.make("22222222-2222-2222-2222-222222222222");

const seedOrg = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${ORG_ID}, 'Acme', now(), now(), null)
      `.pipe(Effect.orDie);
});

describeServer(
  "POST /orgs/:orgId/invitations/:invitationId/resend (integration)",
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
    it.effect("resends an open invitation and keeps it on the pending list", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);

        const { invitationId } = yield* client.organization.inviteUser({
          params: { orgId: ORG_ID },
          payload: new OrganizationContract.InviteUserPayload({ email: "alice@example.com" }),
        });

        yield* client.organization.resendInvitation({
          params: { orgId: ORG_ID, invitationId },
        });

        // Still exactly one open invitation (reissue, not duplicate).
        const res = yield* client.organization.findInvitations({ params: { orgId: ORG_ID } });
        deepStrictEqual(res.invitations.length, 1);
        deepStrictEqual(res.invitations[0]?.invitationId, invitationId);
      }),
    );

    it.effect("returns 404 for an unknown invitation", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);

        const exit = yield* Effect.exit(
          client.organization.resendInvitation({
            params: { orgId: ORG_ID, invitationId: UNKNOWN_INVITATION_ID },
          }),
        );

        ok(Exit.isFailure(exit));

        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          deepStrictEqual(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)._tag,
            "InvitationNotFoundError",
          );
        }
      }),
    );
  },
);
