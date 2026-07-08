import * as Cause from "effect/Cause";
import * as Option from "effect/Option";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { describe, it } from "@effect/vitest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { Api } from "@/api.js";
import { MEMBER_CALLER_ID } from "@/test-utils/fake-auth-middleware.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const suite = describe.sequential;

const ORG_ID = "11111111-1111-1111-1111-111111111111" as never;
const UNKNOWN_ORG_ID = "99999999-9999-9999-9999-999999999999" as never;
// The seeded member caller doubles as the removal target — its user row is
// inserted by `seedSuperAdminCaller`, so no extra user fixture is needed.
const TARGET_ID = MEMBER_CALLER_ID as never;

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

const seedTargetMembership = Effect.gen(function* () {
  const db = yield* Database.Database;
  yield* db
    .execute((c) =>
      c.query(sql.unsafe`
        INSERT INTO "organization".memberships (user_id, organization_id, created_at)
        VALUES (${TARGET_ID}, ${ORG_ID}, now())
      `),
    )
    .pipe(Effect.orDie);
});

suite("DELETE /orgs/:orgId/members/:userId (integration, super-admin caller)", () => {
  const { run } = useServerTestRuntime(
    [
      "organization.organization_roles",
      "organization.memberships",
      "organization.organizations",
      "platform.roles",
      "user.users",
    ],
    { seedSuperAdminCaller: true },
  );

  it("removes the target member from the org", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        yield* seedTargetMembership;
        const client = yield* HttpApiClient.make(Api);

        yield* client.organization.removeMember({ path: { orgId: ORG_ID, userId: TARGET_ID } });

        const after = yield* client.organization.findMembers({ path: { orgId: ORG_ID } });
        const stillMember = after.members.some((m) => m.userId === TARGET_ID);
        deepStrictEqual(stillMember, false);
      }),
    );
  });

  it("returns 404 when the target is not a member of the org", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organization.removeMember({ path: { orgId: ORG_ID, userId: TARGET_ID } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          deepStrictEqual(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)._tag, "MembershipNotFoundError");
        }
      }),
    );
  });

  it("returns 404 when the organization does not exist", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organization.removeMember({
            path: { orgId: UNKNOWN_ORG_ID, userId: TARGET_ID },
          }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          deepStrictEqual(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)._tag, "OrganizationNotFoundError");
        }
      }),
    );
  });
});

suite("DELETE /orgs/:orgId/members/:userId (integration, non-admin member caller)", () => {
  const { run } = useServerTestRuntime(
    [
      "organization.organization_roles",
      "organization.memberships",
      "organization.organizations",
      "platform.roles",
      "user.users",
    ],
    { server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  );

  it("forbids a member who is not an org admin from removing members", async () => {
    await run(
      Effect.gen(function* () {
        yield* seedOrg;
        yield* seedTargetMembership;
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organization.removeMember({ path: { orgId: ORG_ID, userId: TARGET_ID } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof CustomHttpApiError.Forbidden);
        }
      }),
    );
  });
});
