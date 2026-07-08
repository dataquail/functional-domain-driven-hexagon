import * as HttpApiClient from "@effect/platform/HttpApiClient";
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
const UNKNOWN_ORG_ID = "99999999-9999-9999-9999-999999999999" as never;

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

suite("POST /orgs/:orgId/invitations (integration, super-admin caller)", () => {
  const { run } = useServerTestRuntime(
    ["organization.invitations", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
  );

  it("creates a pending invitation for the invitee email", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);

        const { invitationId } = yield* client.organization.inviteUser({
          path: { orgId: ORG_ID },
          payload: { email: "alice@example.com" },
        });

        const res = yield* client.organization.findInvitations({ path: { orgId: ORG_ID } });
        deepStrictEqual(res.invitations.length, 1);
        const invitation = res.invitations[0];
        ok(invitation !== undefined);
        deepStrictEqual(invitation.invitationId, invitationId);
        deepStrictEqual(invitation.inviteeEmail, "alice@example.com");
        deepStrictEqual(invitation.status, "pending");
      }),
    );
  });

  it("re-inviting the same email reissues rather than duplicating", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);

        yield* client.organization.inviteUser({
          path: { orgId: ORG_ID },
          payload: { email: "alice@example.com" },
        });
        yield* client.organization.inviteUser({
          path: { orgId: ORG_ID },
          payload: { email: "alice@example.com" },
        });

        const res = yield* client.organization.findInvitations({ path: { orgId: ORG_ID } });
        deepStrictEqual(res.invitations.length, 1);
      }),
    );
  });

  it("returns 404 when the organization does not exist", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organization.inviteUser({
            path: { orgId: UNKNOWN_ORG_ID },
            payload: { email: "alice@example.com" },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          deepStrictEqual(exit.cause.error._tag, "OrganizationNotFoundError");
        }
      }),
    );
  });
});

suite("POST /orgs/:orgId/invitations (integration, non-admin member caller)", () => {
  const { run } = useServerTestRuntime(
    ["organization.invitations", "organization.organizations", "platform.roles", "user.users"],
    { server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  );

  it("forbids a member who is not an org admin from inviting", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organization.inviteUser({
            path: { orgId: ORG_ID },
            payload: { email: "alice@example.com" },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof CustomHttpApiError.Forbidden);
        }
      }),
    );
  });
});
