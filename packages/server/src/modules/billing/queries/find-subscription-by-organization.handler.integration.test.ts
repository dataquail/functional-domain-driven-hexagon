import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { beforeEach } from "vitest";

import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription.repository.js";
import { SubscriptionId } from "@/modules/billing/domain/subscription.id.js";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription.root.js";
import { SubscriptionRepositoryLive } from "@/modules/billing/infrastructure/repositories/subscription.repository-live.js";
import { findSubscriptionByOrganization } from "@/modules/billing/queries/find-subscription-by-organization.handler.js";
import { FindSubscriptionByOrganizationQuery } from "@/modules/billing/queries/find-subscription-by-organization.query.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { hasTestDatabase, TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const acme = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const beta = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const subId = SubscriptionId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const now = DateTime.unsafeMake(new Date("2025-01-01T00:00:00Z"));

const TestLayer = SubscriptionRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));

// The subscription FKs org_id → organization.organizations. Seed that FK
// precondition with direct SQL — the smallest seam for a cross-module row,
// and the same pattern as subscription.repository-live.integration.test.ts.
// Importing the organization module's repository here would breach the
// cross-module barrel rule (module-barrel-only-cross-module).
const seedOrg = (id: OrganizationId, name: string) =>
  Effect.gen(function* () {
    const db = yield* Database.Database;
    yield* db
      .execute((c) =>
        c.query(sql.unsafe`
          INSERT INTO "organization".organizations (id, name, created_at, updated_at, deleted_at)
          VALUES (${id}, ${name}, NOW(), NOW(), null)
        `),
      )
      .pipe(Effect.orDie);
  });

const suite = hasTestDatabase ? describe.sequential : describe.skip;

suite("findSubscriptionByOrganization (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("billing.subscriptions", "organization.organizations").pipe(
        Effect.provide(TestDatabaseLive),
      ),
    );
  });

  it.effect(
    "returns Some(view) when a subscription exists, mapping to the cross-boundary shape",
    () =>
      Effect.gen(function* () {
        yield* seedOrg(acme, "Acme");
        const repo = yield* SubscriptionRepository;
        const { subscription } = SubscriptionRootOps.create({
          id: subId,
          organizationId: acme,
          stripeCustomerId: "cus_acme",
          stripeSubscriptionId: "sub_acme",
          status: "active",
          currentPeriodEnd: null,
          now,
        });
        yield* repo.insertOne(subscription);

        const result = yield* findSubscriptionByOrganization(
          FindSubscriptionByOrganizationQuery.make({ organizationId: acme }),
        );
        ok(Option.isSome(result));
        const view = Option.getOrThrow(result);
        deepStrictEqual(view.id, subId);
        deepStrictEqual(view.organizationId, acme);
        deepStrictEqual(view.status, "active");
      }).pipe(Effect.provide(TestLayer)),
  );

  it.effect("returns None when no subscription exists for the org", () =>
    Effect.gen(function* () {
      yield* seedOrg(beta, "Beta");
      const result = yield* findSubscriptionByOrganization(
        FindSubscriptionByOrganizationQuery.make({ organizationId: beta }),
      );
      ok(Option.isNone(result));
    }).pipe(Effect.provide(TestLayer)),
  );
});
