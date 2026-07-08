import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";

const suite = describe.sequential;

const ORG_ID = "11111111-1111-1111-1111-111111111111" as never;
const UNKNOWN_INVITATION_ID = "22222222-2222-2222-2222-222222222222" as never;

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

suite("POST /orgs/:orgId/invitations/:invitationId/resend (integration)", () => {
  const { run } = useServerTestRuntime(
    ["organization.invitations", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
  );

  it("resends an open invitation and keeps it on the pending list", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        const { invitationId } = yield* client.organization.inviteUser({
          path: { orgId: ORG_ID },
          payload: { email: "alice@example.com" },
        });

        yield* client.organization.resendInvitation({
          path: { orgId: ORG_ID, invitationId },
        });

        // Still exactly one open invitation (reissue, not duplicate).
        const res = yield* client.organization.findInvitations({ path: { orgId: ORG_ID } });
        deepStrictEqual(res.invitations.length, 1);
        deepStrictEqual(res.invitations[0]?.invitationId, invitationId);
      }),
    );
  });

  it("returns 404 for an unknown invitation", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organization.resendInvitation({
            path: { orgId: ORG_ID, invitationId: UNKNOWN_INVITATION_ID },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          deepStrictEqual(exit.cause.error._tag, "InvitationNotFoundError");
        }
      }),
    );
  });
});
