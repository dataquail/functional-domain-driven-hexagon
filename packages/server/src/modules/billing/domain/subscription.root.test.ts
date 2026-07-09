import { describe, it } from "@effect/vitest";
import { deepStrictEqual, ok } from "assert";
import * as DateTime from "effect/DateTime";

import { SubscriptionId } from "@/modules/billing/domain/subscription.id.js";
import {
  type SubscriptionRoot,
  SubscriptionRootOps,
} from "@/modules/billing/domain/subscription.root.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

const subscriptionId = SubscriptionId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const organizationId = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));
const later = DateTime.makeUnsafe(new Date("2025-02-01T00:00:00Z"));
const periodEnd = DateTime.makeUnsafe(new Date("2025-02-15T00:00:00Z"));

const fresh = (status = "active"): SubscriptionRoot =>
  SubscriptionRootOps.create({
    id: subscriptionId,
    organizationId,
    stripeCustomerId: "cus_test",
    stripeSubscriptionId: "sub_test",
    status,
    currentPeriodEnd: periodEnd,
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
      currentPeriodEnd: periodEnd,
      now,
    });
    deepStrictEqual(subscription.id, subscriptionId);
    deepStrictEqual(subscription.organizationId, organizationId);
    deepStrictEqual(subscription.stripeCustomerId, "cus_abc");
    deepStrictEqual(subscription.stripeSubscriptionId, "sub_xyz");
    deepStrictEqual(subscription.status, "trialing");
    deepStrictEqual(subscription.currentPeriodEnd, periodEnd);
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
      currentPeriodEnd: null,
      now,
    });
    deepStrictEqual(events.length, 1);
    const event = events[0];
    ok(event !== undefined);
    if (event._tag !== "SubscriptionStarted") throw new Error("expected SubscriptionStarted");
    deepStrictEqual(event.subscriptionId, subscriptionId);
    deepStrictEqual(event.organizationId, organizationId);
    deepStrictEqual(event.stripeSubscriptionId, "sub_xyz");
    deepStrictEqual(event.status, "active");
  });

  it("accepts a null currentPeriodEnd (e.g. an incomplete subscription before first invoice)", () => {
    const { subscription } = SubscriptionRootOps.create({
      id: subscriptionId,
      organizationId,
      stripeCustomerId: "cus_abc",
      stripeSubscriptionId: "sub_xyz",
      status: "incomplete",
      currentPeriodEnd: null,
      now,
    });
    deepStrictEqual(subscription.currentPeriodEnd, null);
  });
});

describe("SubscriptionRootOps.applyStatus", () => {
  it("replaces status + currentPeriodEnd + updatedAt and preserves identity columns", () => {
    const sub = fresh("trialing");
    const newPeriodEnd = DateTime.makeUnsafe(new Date("2025-03-01T00:00:00Z"));
    const { events, subscription } = SubscriptionRootOps.applyStatus(sub, {
      status: "active",
      currentPeriodEnd: newPeriodEnd,
      now: later,
    });
    deepStrictEqual(subscription.id, sub.id);
    deepStrictEqual(subscription.organizationId, sub.organizationId);
    deepStrictEqual(subscription.stripeCustomerId, sub.stripeCustomerId);
    deepStrictEqual(subscription.stripeSubscriptionId, sub.stripeSubscriptionId);
    deepStrictEqual(subscription.createdAt, sub.createdAt);
    deepStrictEqual(subscription.status, "active");
    deepStrictEqual(subscription.currentPeriodEnd, newPeriodEnd);
    deepStrictEqual(subscription.updatedAt, later);
    const event = events[0];
    ok(event !== undefined);
    if (event._tag !== "SubscriptionStatusChanged") throw new Error("expected status change");
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
    const event = events[0];
    ok(event !== undefined);
    if (event._tag !== "SubscriptionStatusChanged") throw new Error("expected status change");
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
    const event = events[0];
    ok(event !== undefined);
    if (event._tag !== "SubscriptionCanceled") throw new Error("expected SubscriptionCanceled");
    deepStrictEqual(event.subscriptionId, sub.id);
    deepStrictEqual(event.organizationId, sub.organizationId);
  });
});

describe("Subscription aggregate purity", () => {
  it("applyStatus/cancel do not mutate the input subscription", () => {
    const sub = fresh("active");
    SubscriptionRootOps.applyStatus(sub, {
      status: "past_due",
      currentPeriodEnd: null,
      now: later,
    });
    SubscriptionRootOps.cancel(sub, later);
    deepStrictEqual(sub.status, "active");
    deepStrictEqual(sub.updatedAt, now);
  });
});
