import { deepStrictEqual, ok } from "node:assert";

import { assertDefined } from "@effect/vitest/utils";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { OrganizationId } from "@org/contracts/EntityIds";
import { Database } from "@org/database/index";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { Api } from "@/globals/infrastructure/framework/http/api";
import { describeServer } from "@/test-utils/server-test-runtime";
import { TestServerLiveAsMember } from "@/test-utils/test-server";

const ORG_ID = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const UNKNOWN_ORG_ID = OrganizationId.make("99999999-9999-9999-9999-999999999999");

const seedOrg = Effect.gen(function* () {
  const sql = yield* Database.Database;
  yield* sql`
        INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
        VALUES (${ORG_ID}, 'Acme', now(), now(), null)
      `.pipe(Effect.orDie);
});

describeServer(
  "POST /orgs/:orgId/invitations (integration, super-admin caller)",
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
    it.effect("creates a pending invitation for the invitee email", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);

        const { invitationId } = yield* client.organization.inviteUser({
          params: { orgId: ORG_ID },
          payload: new OrganizationContract.InviteUserPayload({ email: "alice@example.com" }),
        });

        const res = yield* client.organization.findInvitations({ params: { orgId: ORG_ID } });
        deepStrictEqual(res.invitations.length, 1);
        const invitation = res.invitations[0];
        assertDefined(invitation);
        deepStrictEqual(invitation.invitationId, invitationId);
        deepStrictEqual(invitation.inviteeEmail, "alice@example.com");
        deepStrictEqual(invitation.status, "pending");
      }),
    );

    it.effect("re-inviting the same email reissues rather than duplicating", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);

        yield* client.organization.inviteUser({
          params: { orgId: ORG_ID },
          payload: new OrganizationContract.InviteUserPayload({ email: "alice@example.com" }),
        });
        yield* client.organization.inviteUser({
          params: { orgId: ORG_ID },
          payload: new OrganizationContract.InviteUserPayload({ email: "alice@example.com" }),
        });

        const res = yield* client.organization.findInvitations({ params: { orgId: ORG_ID } });
        deepStrictEqual(res.invitations.length, 1);
      }),
    );

    it.effect("returns 404 when the organization does not exist", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const exit = yield* Effect.exit(
          client.organization.inviteUser({
            params: { orgId: UNKNOWN_ORG_ID },
            payload: new OrganizationContract.InviteUserPayload({ email: "alice@example.com" }),
          }),
        );

        ok(Exit.isFailure(exit));

        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          deepStrictEqual(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)._tag,
            "OrganizationNotFoundError",
          );
        }
      }),
    );
  },
);

describeServer(
  "POST /orgs/:orgId/invitations (integration, non-admin member caller)",
  {
    tables: [
      "organization.invitations",
      "organization.organizations",
      "platform.roles",
      "user.users",
    ],
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  },
  (it) => {
    it.effect("forbids a member who is not an org admin from inviting", () =>
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);

        const exit = yield* Effect.exit(
          client.organization.inviteUser({
            params: { orgId: ORG_ID },
            payload: new OrganizationContract.InviteUserPayload({ email: "alice@example.com" }),
          }),
        );

        ok(Exit.isFailure(exit));

        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(
            Schema.is(CustomHttpApiError.Forbidden)(
              Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow),
            ),
          );
        }
      }),
    );
  },
);
