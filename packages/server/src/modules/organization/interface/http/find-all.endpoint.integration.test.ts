import * as HttpApiClient from "@effect/platform/HttpApiClient";
import { describe, it } from "@effect/vitest";
import * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { hasTestDatabase } from "@/test-utils/test-database.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("GET /admin/orgs (integration)", () => {
  const { run } = useServerTestRuntime(["organization.organizations", "platform.roles"], {
    seedSuperAdminCaller: true,
  });

  it("returns created orgs (active-only by default)", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        yield* client.organization.create({ payload: { name: "Acme" } });
        const { id: betaId } = yield* client.organization.create({ payload: { name: "Beta" } });
        yield* client.organization.softDelete({ path: { id: betaId } });

        const res = yield* client.organizationAdmin.findAll({
          urlParams: { page: 1, pageSize: 10 },
        });
        deepStrictEqual(res.total, 1);
        deepStrictEqual(res.organizations[0]?.name, "Acme");
      }),
    );
  });

  it("returns tombstoned orgs when includeDeleted=true", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        yield* client.organization.create({ payload: { name: "Acme" } });
        const { id: betaId } = yield* client.organization.create({ payload: { name: "Beta" } });
        yield* client.organization.softDelete({ path: { id: betaId } });

        const res = yield* client.organizationAdmin.findAll({
          urlParams: { page: 1, pageSize: 10, includeDeleted: "true" },
        });
        deepStrictEqual(res.total, 2);
      }),
    );
  });
});

const memberSuite = hasTestDatabase ? describe.sequential : describe.skip;

memberSuite("GET /admin/orgs (integration, non-super-admin caller)", () => {
  const { run } = useServerTestRuntime(["organization.organizations", "platform.roles"], {
    server: TestServerLiveAsMember,
  });

  it("returns 403 Forbidden", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const exit = yield* Effect.exit(
          client.organizationAdmin.findAll({ urlParams: { page: 1, pageSize: 10 } }),
        );
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && exit.cause._tag === "Fail") {
          ok(exit.cause.error instanceof CustomHttpApiError.Forbidden);
        }
      }),
    );
  });
});
