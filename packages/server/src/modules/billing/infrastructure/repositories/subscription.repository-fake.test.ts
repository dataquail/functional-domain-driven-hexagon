import * as Cause from "effect/Cause";
import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Option from "effect/Option";

import { SubscriptionRepository } from "@/modules/billing/domain/ports/repositories/subscription.repository.js";
import { SubscriptionAlreadyExistsForOrganization } from "@/modules/billing/domain/subscription.errors.js";
import { SubscriptionId } from "@/modules/billing/domain/subscription.id.js";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription.root.js";
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
  it.effect("stores a subscription and makes it findable by organizationId", () =>
    Effect.gen(function* () {
      const repo = yield* SubscriptionRepository;
      yield* repo.insertOne(mk(subA, acme));
      const found = yield* repo.findOneByOrganizationId(acme);
      ok(Option.isSome(found));
      if (Option.isSome(found)) deepStrictEqual(found.value.id, subA);
    }).pipe(provide),
  );

  it.effect("fails SubscriptionAlreadyExistsForOrganization on duplicate org", () =>
    Effect.gen(function* () {
      const repo = yield* SubscriptionRepository;
      yield* repo.insertOne(mk(subA, acme));
      const exit = yield* Effect.exit(repo.insertOne(mk(subB, acme, "sub_y")));
      ok(Exit.isFailure(exit));
      if (Exit.isFailure(exit) && Cause.hasFails(exit.cause)) {
        ok(Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow) instanceof SubscriptionAlreadyExistsForOrganization);
      }
    }).pipe(provide),
  );

  it.effect("allows different organizations to each have their own subscription", () =>
    Effect.gen(function* () {
      const repo = yield* SubscriptionRepository;
      yield* repo.insertOne(mk(subA, acme, "sub_a"));
      yield* repo.insertOne(mk(subB, beta, "sub_b"));
      const a = yield* repo.findOneByOrganizationId(acme);
      const b = yield* repo.findOneByOrganizationId(beta);
      ok(Option.isSome(a) && Option.isSome(b));
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
      const found = yield* repo.findOneByOrganizationId(acme);
      ok(Option.isSome(found));
      if (Option.isSome(found)) deepStrictEqual(found.value.status, "canceled");
    }).pipe(provide),
  );
});

describe("SubscriptionRepositoryFake.findOneByStripeSubscriptionId", () => {
  it.effect("returns the subscription that has the matching Stripe id", () =>
    Effect.gen(function* () {
      const repo = yield* SubscriptionRepository;
      yield* repo.insertOne(mk(subA, acme, "sub_unique"));
      const found = yield* repo.findOneByStripeSubscriptionId("sub_unique");
      ok(Option.isSome(found));
      if (Option.isSome(found)) deepStrictEqual(found.value.id, subA);
    }).pipe(provide),
  );

  it.effect("returns None when no subscription has the given Stripe id", () =>
    Effect.gen(function* () {
      const repo = yield* SubscriptionRepository;
      const found = yield* repo.findOneByStripeSubscriptionId("sub_does_not_exist");
      ok(Option.isNone(found));
    }).pipe(provide),
  );
});

describe("SubscriptionRepositoryFake.findOneByOrganizationId", () => {
  it.effect("returns None for an org with no subscription", () =>
    Effect.gen(function* () {
      const repo = yield* SubscriptionRepository;
      const found = yield* repo.findOneByOrganizationId(acme);
      ok(Option.isNone(found));
    }).pipe(provide),
  );
});
