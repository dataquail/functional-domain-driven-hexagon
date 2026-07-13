import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription/subscription.errors.js";
import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import { SubscriptionRepository } from "@/modules/billing/domain/subscription/subscription.repository.js";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription/subscription.root-ops.js";
import { SubscriptionSpecifications } from "@/modules/billing/domain/subscription/subscription.specification.js";
import { SubscriptionRepositoryFake } from "@/modules/billing/infrastructure/repositories/subscription.repository-fake.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

const acme = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const beta = OrganizationId.make("22222222-2222-2222-2222-222222222222");
const subA = SubscriptionId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const subB = SubscriptionId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const provide = Effect.provide(SubscriptionRepositoryFake);

const mk = (id: SubscriptionId, organizationId: OrganizationId, stripeSub = "sub_x") =>
  SubscriptionRootOps.create({
    id,
    organizationId,
    stripeCustomerId: "cus_x",
    stripeSubscriptionId: stripeSub,
    status: "active",
    currentPeriodEnd: null,
    now,
  }).subscription;

describe("SubscriptionRepositoryFake.insert", () => {
  it.effect("stores a subscription and makes it findable by organization", () =>
    Effect.gen(function* () {
      const repo = yield* SubscriptionRepository;
      yield* repo.insertOne(mk(subA, acme));
      const found = yield* repo.findOne(SubscriptionSpecifications.forOrganization(acme));
      ok(found !== null);
      deepStrictEqual(found.id, subA);
    }).pipe(provide),
  );

  it.effect("fails SubscriptionAlreadyExistsForOrganization on duplicate org", () =>
    Effect.gen(function* () {
      const repo = yield* SubscriptionRepository;
      yield* repo.insertOne(mk(subA, acme));
      const exit = yield* Effect.exit(repo.insertOne(mk(subB, acme, "sub_y")));
      ok(Exit.isFailure(exit));
      if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
        ok(
          Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof
            SubscriptionAlreadyExistsForOrganization,
        );
      }
    }).pipe(provide),
  );

  it.effect("allows different organizations to each have their own subscription", () =>
    Effect.gen(function* () {
      const repo = yield* SubscriptionRepository;
      yield* repo.insertOne(mk(subA, acme, "sub_a"));
      yield* repo.insertOne(mk(subB, beta, "sub_b"));
      const a = yield* repo.findOne(SubscriptionSpecifications.forOrganization(acme));
      const b = yield* repo.findOne(SubscriptionSpecifications.forOrganization(beta));
      ok(a !== null && b !== null);
    }).pipe(provide),
  );
});

describe("SubscriptionRepositoryFake.update", () => {
  it.effect("replaces an existing subscription's fields by id", () =>
    Effect.gen(function* () {
      const repo = yield* SubscriptionRepository;
      const sub = mk(subA, acme);
      yield* repo.insertOne(sub);
      const { subscription: canceled } = SubscriptionRootOps.cancel(sub, now);
      yield* repo.updateOne(canceled);
      const found = yield* repo.findOne(SubscriptionSpecifications.forOrganization(acme));
      ok(found !== null);
      deepStrictEqual(found.status, "canceled");
    }).pipe(provide),
  );
});

describe("SubscriptionRepositoryFake.findOne by Stripe subscription id", () => {
  it.effect("returns the subscription that has the matching Stripe id", () =>
    Effect.gen(function* () {
      const repo = yield* SubscriptionRepository;
      yield* repo.insertOne(mk(subA, acme, "sub_unique"));
      const found = yield* repo.findOne(
        SubscriptionSpecifications.withStripeSubscriptionId("sub_unique"),
      );
      ok(found !== null);
      deepStrictEqual(found.id, subA);
    }).pipe(provide),
  );

  it.effect("returns null when no subscription has the given Stripe id", () =>
    Effect.gen(function* () {
      const repo = yield* SubscriptionRepository;
      const found = yield* repo.findOne(
        SubscriptionSpecifications.withStripeSubscriptionId("sub_does_not_exist"),
      );
      deepStrictEqual(found, null);
    }).pipe(provide),
  );
});

describe("SubscriptionRepositoryFake.findOne by organization", () => {
  it.effect("returns null for an org with no subscription", () =>
    Effect.gen(function* () {
      const repo = yield* SubscriptionRepository;
      const found = yield* repo.findOne(SubscriptionSpecifications.forOrganization(acme));
      deepStrictEqual(found, null);
    }).pipe(provide),
  );
});
