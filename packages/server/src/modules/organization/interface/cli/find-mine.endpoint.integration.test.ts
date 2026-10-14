import { deepStrictEqual } from "node:assert";

import { assertDefined } from "@effect/vitest/utils";
import { OrganizationContract } from "@org/contracts/api/Contracts";
import * as Effect from "effect/Effect";
import * as HttpApiClient from "effect/http-api/HttpApiClient";

import { Api } from "@/globals/infrastructure/framework/http/api.ts";
import { describeServer } from "@/test-utils/server-test-runtime.ts";
import { TestServerLiveAsMember } from "@/test-utils/test-server.ts";

const ORG_TABLES = [
  "organization.organization_roles",
  "organization.memberships",
  "organization.organizations",
  "platform.roles",
  "user.users",
] as const;

describeServer(
  "GET /cli/orgs (integration)",
  { tables: ORG_TABLES, server: TestServerLiveAsMember, seedSuperAdminCaller: true },
  (it) => {
    it.effect("lists the caller's organizations via the CLI surface", () =>
      Effect.gen(function* () {
        const client = yield* HttpApiClient.make(Api);

        const { id: orgId } = yield* client.organization.create({
          payload: new OrganizationContract.CreateOrganizationPayload({ name: "Acme" }),
        });

        const orgs = yield* client.cliOrganization.listMine();
        deepStrictEqual(
          orgs.map((o) => o.id),
          [orgId],
        );
        const [first] = orgs;
        assertDefined(first);
        deepStrictEqual(first.name, "Acme");
        // Creator becomes the org admin (Phase 4 grant bundle).
        deepStrictEqual(first.isAdmin, true);
      }),
    );
  },
);
