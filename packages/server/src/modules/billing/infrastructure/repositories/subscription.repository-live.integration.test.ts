import { describe, it } from "@effect/vitest";
import { Database, sql } from "@org/database/index";
import { deepStrictEqual, ok } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import { beforeEach } from "vitest";

import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription/subscription.errors.js";
import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.js";
import { type SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription/subscription.root-ops.js";
import { SubscriptionRepositoryLive } from "@/modules/billing/infrastructure/repositories/subscription.repository-live.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";
import { TestDatabaseLive, truncate } from "@/test-utils/test-database.js";

const acme = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const beta = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const subA = SubscriptionId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const subB = SubscriptionId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));
const periodEnd = DateTime.makeUnsafe(new Date("2025-02-01T00:00:00Z"));

const mk = (
  id: SubscriptionId,
  organizationId: OrganizationId,
  stripeSub: string,
  status = "active",
): SubscriptionRoot =>
  SubscriptionRootOps.create({
    id,
    organizationId,
    stripeCustomerId: `cus_${organizationId}`,
    stripeSubscriptionId: stripeSub,
    status,
    currentPeriodEnd: periodEnd,
    now,
  }).subscription;

// FK precondition only — see wallet-repository-live.integration.test.ts
// for the same pattern. Direct SQL is the smallest seam for a cross-
// module FK row.
const seedOrgRow = (id: OrganizationId, name: string) =>
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

const TestLayer = SubscriptionRepositoryLive.pipe(Layer.provideMerge(TestDatabaseLive));
const suite = describe.sequential;

suite("SubscriptionRepositoryLive (integration)", () => {
  beforeEach(async () => {
    await Effect.runPromise(
      truncate("billing.subscriptions", "organization.organizations").pipe(
        Effect.provide(TestDatabaseLive),
      ),
    );
  });

  describe("insert", () => {
    it.effect("persists and decodes back via findOneByOrganizationId", () =>
      Effect.gen(function* () {
        yield* seedOrgRow(acme, "Acme");
        const repo = yield* SubscriptionRepository;
        yield* repo.insertOne(mk(subA, acme, "sub_acme"));
        const found = yield* repo.findOneByOrganizationId(acme);
        ok(Option.isSome(found));
        if (Option.isSome(found)) {
          deepStrictEqual(found.value.id, subA);
          deepStrictEqual(found.value.stripeSubscriptionId, "sub_acme");
          deepStrictEqual(found.value.status, "active");
        }
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("fails SubscriptionAlreadyExistsForOrganization on duplicate org", () =>
      Effect.gen(function* () {
        yield* seedOrgRow(acme, "Acme");
        const repo = yield* SubscriptionRepository;
        yield* repo.insertOne(mk(subA, acme, "sub_a"));
        const exit = yield* Effect.exit(repo.insertOne(mk(subB, acme, "sub_b")));
        ok(Exit.isFailure(exit));
        if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
          ok(
            Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof
              SubscriptionAlreadyExistsForOrganization,
          );
        }
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("update", () => {
    it.effect("replaces status, currentPeriodEnd, updatedAt for the matching id", () =>
      Effect.gen(function* () {
        yield* seedOrgRow(acme, "Acme");
        const repo = yield* SubscriptionRepository;
        const sub = mk(subA, acme, "sub_acme");
        yield* repo.insertOne(sub);
        const { subscription: canceled } = SubscriptionRootOps.cancel(sub, now);
        yield* repo.updateOne(canceled);
        const found = yield* repo.findOneByOrganizationId(acme);
        ok(Option.isSome(found));
        if (Option.isSome(found)) deepStrictEqual(found.value.status, "canceled");
      }).pipe(Effect.provide(TestLayer)),
    );
  });

  describe("findOneByStripeSubscriptionId", () => {
    it.effect("returns the subscription that has the matching Stripe id (cross-tenant safe)", () =>
      Effect.gen(function* () {
        yield* seedOrgRow(acme, "Acme");
        yield* seedOrgRow(beta, "Beta");
        const repo = yield* SubscriptionRepository;
        yield* repo.insertOne(mk(subA, acme, "sub_acme_id"));
        yield* repo.insertOne(mk(subB, beta, "sub_beta_id"));
        const found = yield* repo.findOneByStripeSubscriptionId("sub_beta_id");
        ok(Option.isSome(found));
        if (Option.isSome(found)) {
          deepStrictEqual(found.value.id, subB);
          deepStrictEqual(found.value.organizationId, beta);
        }
      }).pipe(Effect.provide(TestLayer)),
    );

    it.effect("returns None when no subscription matches", () =>
      Effect.gen(function* () {
        const repo = yield* SubscriptionRepository;
        const found = yield* repo.findOneByStripeSubscriptionId("sub_unknown");
        ok(Option.isNone(found));
      }).pipe(Effect.provide(TestLayer)),
    );
  });
});
