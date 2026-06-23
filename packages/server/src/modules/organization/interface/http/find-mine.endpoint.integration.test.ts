import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("GET /orgs (integration — findMine)", () => {
  // findMine returns the caller's own orgs, so the caller must be able to own
  // them: a regular member, not a super-admin.
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

  it("returns the caller's organizations, most-recently-created first", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        yield* client.organization.create({ payload: { name: "Acme" } });
        yield* client.organization.create({ payload: { name: "Beta" } });

        const orgs = yield* client.organization.findMine();
        deepStrictEqual(
          orgs.map((o) => o.name),
          ["Beta", "Acme"],
        );
        // The creator is auto-granted the `admin` role, so both orgs the
        // caller just created come back flagged `isAdmin`.
        deepStrictEqual(
          orgs.map((o) => o.isAdmin),
          [true, true],
        );
      }),
    );
  });

  it("returns empty when the caller has no memberships", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const orgs = yield* client.organization.findMine();
        deepStrictEqual([...orgs], []);
      }),
    );
  });

  it("hides soft-deleted orgs", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        yield* client.organization.create({ payload: { name: "Acme" } });
        const { id: betaId } = yield* client.organization.create({ payload: { name: "Beta" } });
        // Soft-delete is super-admin-only, so the member can't tombstone via
        // the endpoint; set the tombstone directly to exercise findMine's filter.
        const db = yield* Database.Database;
        yield* db
          .execute((c) =>
            c.query(sql.unsafe`
              UPDATE "organization".organizations SET deleted_at = now() WHERE id = ${betaId}
            `),
          )
          .pipe(Effect.orDie);

        const orgs = yield* client.organization.findMine();
        deepStrictEqual(
          orgs.map((o) => o.name),
          ["Acme"],
        );
      }),
    );
  });
});
