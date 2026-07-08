import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { describe, it } from "@effect/vitest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

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

suite("DELETE /orgs/:orgId/invitations/:invitationId (integration, super-admin caller)", () => {
  const { run } = useServerTestRuntime(
    ["organization.invitations", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
  );

  it("revokes a pending invitation so it drops off the pending list", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        const { invitationId } = yield* client.organization.inviteUser({
          path: { orgId: ORG_ID },
          payload: { email: "alice@example.com" },
        });

        yield* client.organization.revokeInvitation({
          path: { orgId: ORG_ID, invitationId },
        });

        const res = yield* client.organization.findInvitations({ path: { orgId: ORG_ID } });
        deepStrictEqual(res.invitations.length, 0);
      }),
    );
  });

  it("returns 410 Gone when the invitation is already revoked", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        const { invitationId } = yield* client.organization.inviteUser({
          path: { orgId: ORG_ID },
          payload: { email: "alice@example.com" },
        });
        yield* client.organization.revokeInvitation({ path: { orgId: ORG_ID, invitationId } });

        const exit = yield* Effect.exit(
          client.organization.revokeInvitation({ path: { orgId: ORG_ID, invitationId } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          const error = exit.cause.error;
          deepStrictEqual(error._tag, "InvitationGoneError");
          deepStrictEqual(error.reason, "revoked");
        }
      }),
    );
  });

  it("returns 404 for an unknown invitation", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organization.revokeInvitation({
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

suite(
  "DELETE /orgs/:orgId/invitations/:invitationId (integration, non-admin member caller)",
  () => {
    const { run } = useServerTestRuntime(
      ["organization.invitations", "organization.organizations", "platform.roles", "user.users"],
      { server: TestServerLiveAsMember, seedSuperAdminCaller: true },
    );

    it("forbids a member who is not an org admin from revoking", async () => {
      await run(
        Effect.gen(function* () {
          yield* seedOrg;
          const db = yield* Database.Database;
          // Seed a pending invitation directly — a non-admin can't create one to
          // then attempt revoking it, and the 403 must fire before any lookup.
          yield* db
            .execute((c) =>
              c.query(sql.unsafe`
              INSERT INTO "organization".invitations
                (id, organization_id, invitee_email, token, expires_at, created_at)
              VALUES (${UNKNOWN_INVITATION_ID}, ${ORG_ID}, 'alice@example.com',
                'seed-token-revoke-forbidden', now() + interval '7 days', now())
            `),
            )
            .pipe(Effect.orDie);

          const client = yield* HttpApiClient.make(Api);
          const exit = yield* Effect.exit(
            client.organization.revokeInvitation({
              path: { orgId: ORG_ID, invitationId: UNKNOWN_INVITATION_ID },
            }),
          );
          ok(Exit.isFailure(exit));
          if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
            ok(exit.cause.error instanceof CustomHttpApiError.Forbidden);
          }
        }),
      );
    });
  },
);
