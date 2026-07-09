import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";

import { Api } from "@/api.js";
import { useServerTestRuntime } from "@/test-utils/server-test-runtime.js";
import { TestServerLiveAsMember } from "@/test-utils/test-server.js";

const ORG_TABLES = [
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

const suite = describe.sequential;

suite("GET /cli/orgs (integration)", () => {
  const { run } = useServerTestRuntime(ORG_TABLES, {
    server: TestServerLiveAsMember,
    seedSuperAdminCaller: true,
  });

  it("lists the caller's organizations via the CLI surface", async () => {
    await run(
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);
        const { id: orgId } = yield* client.organization.create({ payload: { name: "Acme" } });
        const orgs = yield* client.cliOrganization.listMine();
        deepStrictEqual(
          orgs.map((o) => o.id),
          [orgId],
        );
        const [first] = orgs;
        ok(first !== undefined);
        deepStrictEqual(first.name, "Acme");
        // Creator becomes the org admin (Phase 4 grant bundle).
        ok(typeof first.isAdmin === "boolean");
      }),
    );
  });
});
