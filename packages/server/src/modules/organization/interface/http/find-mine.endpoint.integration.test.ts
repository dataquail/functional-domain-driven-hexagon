import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("GET /orgs (integration — findMine)", () => {
  const { run } = useServerTestRuntime(
    ["organization.memberships", "organization.organizations", "platform.roles", "user.users"],
    { seedSuperAdminCaller: true },
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
        yield* client.organization.softDelete({ path: { id: betaId } });

        const orgs = yield* client.organization.findMine();
        deepStrictEqual(
          orgs.map((o) => o.name),
          ["Acme"],
        );
      }),
    );
  });
});
