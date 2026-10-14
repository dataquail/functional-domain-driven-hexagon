import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Arr from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/globals/application/ddd/ids/organization-id.js";
import {
  SubscriptionCanceled,
  type SubscriptionEvent,
  SubscriptionStarted,
  SubscriptionStatusChanged,
} from "@/modules/billing/domain/subscription/subscription.events.js";
import { SubscriptionId } from "@/modules/billing/domain/subscription/subscription.id.js";
import { type SubscriptionRoot } from "@/modules/billing/domain/subscription/subscription.root.js";
import { SubscriptionRootOps } from "@/modules/billing/domain/subscription/subscription.root-ops.js";

const subscriptionId = SubscriptionId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const organizationId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.makeUnsafe("2025-01-01T00:00:00Z");
const later = DateTime.makeUnsafe("2025-02-01T00:00:00Z");
const periodEnd = DateTime.makeUnsafe("2025-02-15T00:00:00Z");

const expectFirstEvent = <S extends Schema.Constraint>(
  events: ReadonlyArray<SubscriptionEvent>,
  schema: S,
): SubscriptionEvent & S["Type"] =>
  Option.getOrThrow(Option.filter(Arr.head(events), Schema.is(schema)));

const fresh = (status = "active"): SubscriptionRoot =>
  SubscriptionRootOps.create({
    id: subscriptionId,
    organizationId,
    stripeCustomerId: "cus_test",
    stripeSubscriptionId: "sub_test",
    status,
    currentPeriodEnd: Option.some(periodEnd),
    now,
  }).subscription;

describe("SubscriptionRootOps.create", () => {
  it("constructs a subscription carrying the given ids/status/period", () => {
    const { subscription } = SubscriptionRootOps.create({
      id: subscriptionId,
      organizationId,
      stripeCustomerId: "cus_abc",
      stripeSubscriptionId: "sub_xyz",
      status: "trialing",
      currentPeriodEnd: Option.some(periodEnd),
      now,
    });

    deepStrictEqual(subscription.id, subscriptionId);
    deepStrictEqual(subscription.organizationId, organizationId);
    deepStrictEqual(subscription.stripeCustomerId, "cus_abc");
    deepStrictEqual(subscription.stripeSubscriptionId, "sub_xyz");
    deepStrictEqual(subscription.status, "trialing");
    deepStrictEqual(subscription.currentPeriodEnd, Option.some(periodEnd));
    deepStrictEqual(subscription.createdAt, now);
    deepStrictEqual(subscription.updatedAt, now);
  });

  it("emits exactly one SubscriptionStarted event with the gateway ids and status", () => {
    const { events } = SubscriptionRootOps.create({
      id: subscriptionId,
      organizationId,
      stripeCustomerId: "cus_abc",
      stripeSubscriptionId: "sub_xyz",
      status: "active",
      currentPeriodEnd: Option.none(),
      now,
    });

    deepStrictEqual(events.length, 1);
    const event = expectFirstEvent(events, SubscriptionStarted.schema);
    deepStrictEqual(event.subscriptionId, subscriptionId);
    deepStrictEqual(event.organizationId, organizationId);
    deepStrictEqual(event.stripeSubscriptionId, "sub_xyz");
    deepStrictEqual(event.status, "active");
  });

  it("accepts an absent currentPeriodEnd (e.g. an incomplete subscription before first invoice)", () => {
    const { subscription } = SubscriptionRootOps.create({
      id: subscriptionId,
      organizationId,
      stripeCustomerId: "cus_abc",
      stripeSubscriptionId: "sub_xyz",
      status: "incomplete",
      currentPeriodEnd: Option.none(),
      now,
    });

    assertNone(subscription.currentPeriodEnd);
  });
});

describe("SubscriptionRootOps.applyStatus", () => {
  it("replaces status + currentPeriodEnd + updatedAt and preserves identity columns", () => {
    const sub = fresh("trialing");
    const newPeriodEnd = DateTime.makeUnsafe("2025-03-01T00:00:00Z");

    const { events, subscription } = SubscriptionRootOps.applyStatus(sub, {
      status: "active",
      currentPeriodEnd: Option.some(newPeriodEnd),
      now: later,
    });

    deepStrictEqual(subscription.id, sub.id);
    deepStrictEqual(subscription.organizationId, sub.organizationId);
    deepStrictEqual(subscription.stripeCustomerId, sub.stripeCustomerId);
    deepStrictEqual(subscription.stripeSubscriptionId, sub.stripeSubscriptionId);
    deepStrictEqual(subscription.createdAt, sub.createdAt);
    deepStrictEqual(subscription.status, "active");
    deepStrictEqual(subscription.currentPeriodEnd, Option.some(newPeriodEnd));
    deepStrictEqual(subscription.updatedAt, later);
    const event = expectFirstEvent(events, SubscriptionStatusChanged.schema);
    deepStrictEqual(event.status, "active");
    deepStrictEqual(event.previousStatus, "trialing");
  });

  it("is idempotent: re-applying the same status still returns post-state with previousStatus equal", () => {
    const sub = fresh("active");

    const { events, subscription } = SubscriptionRootOps.applyStatus(sub, {
      status: "active",
      currentPeriodEnd: sub.currentPeriodEnd,
      now: later,
    });

    deepStrictEqual(subscription.status, "active");
    const event = expectFirstEvent(events, SubscriptionStatusChanged.schema);
    deepStrictEqual(event.previousStatus, "active");
  });
});

describe("SubscriptionRootOps.cancel", () => {
  it("sets status to 'canceled', preserves currentPeriodEnd, refreshes updatedAt", () => {
    const sub = fresh("active");
    const { events, subscription } = SubscriptionRootOps.cancel(sub, later);
    deepStrictEqual(subscription.status, "canceled");
    deepStrictEqual(subscription.currentPeriodEnd, sub.currentPeriodEnd);
    deepStrictEqual(subscription.updatedAt, later);
    const event = expectFirstEvent(events, SubscriptionCanceled.schema);
    deepStrictEqual(event.subscriptionId, sub.id);
    deepStrictEqual(event.organizationId, sub.organizationId);
  });
});

describe("Subscription aggregate purity", () => {
  it("applyStatus/cancel do not mutate the input subscription", () => {
    const sub = fresh("active");
    SubscriptionRootOps.applyStatus(sub, {
      status: "past_due",
      currentPeriodEnd: Option.none(),
      now: later,
    });
    SubscriptionRootOps.cancel(sub, later);
    deepStrictEqual(sub.status, "active");
    deepStrictEqual(sub.updatedAt, now);
  });
});
