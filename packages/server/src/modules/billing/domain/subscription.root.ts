import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import {
  SubscriptionCanceled,
  type SubscriptionEvent,
  SubscriptionStarted,
  SubscriptionStatusChanged,
} from "./subscription.events.js";
import { SubscriptionId } from "./subscription.id.js";

// `status` is a free-form string. The Stripe vocabulary
// (`active | past_due | canceled | trialing | incomplete | unpaid | ...`)
// is not enumerated in the aggregate because:
//   1. Stripe owns the lifecycle. New statuses ship without notice.
//   2. We never make a domain decision based on this string — it's a
//      projection rendered through to the API consumer. Other modules
//      that need a coarser "is this org paid?" question should ask the
//      domain method instead of inspecting the literal.
export class SubscriptionRoot extends Schema.Class<SubscriptionRoot>("SubscriptionRoot")({
  id: SubscriptionId,
  organizationId: OrganizationId,
  stripeCustomerId: Schema.String,
  stripeSubscriptionId: Schema.String,
  status: Schema.String,
  currentPeriodEnd: Schema.NullOr(Schema.DateTimeUtc),
  createdAt: Schema.DateTimeUtc,
  updatedAt: Schema.DateTimeUtc,
}) {}

export type Result = {
  readonly subscription: SubscriptionRoot;
  readonly events: ReadonlyArray<SubscriptionEvent>;
};

export type CreateInput = {
  readonly id: SubscriptionId;
  readonly organizationId: OrganizationId;
  readonly stripeCustomerId: string;
  readonly stripeSubscriptionId: string;
  readonly status: string;
  readonly currentPeriodEnd: DateTime.Utc | null;
  readonly now: DateTime.Utc;
};

const create = (input: CreateInput): Result => {
  const subscription = SubscriptionRoot.make({
    id: input.id,
    organizationId: input.organizationId,
    stripeCustomerId: input.stripeCustomerId,
    stripeSubscriptionId: input.stripeSubscriptionId,
    status: input.status,
    currentPeriodEnd: input.currentPeriodEnd,
    createdAt: input.now,
    updatedAt: input.now,
  });
  return {
    subscription,
    events: [
      SubscriptionStarted.make({
        subscriptionId: subscription.id,
        organizationId: subscription.organizationId,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        status: subscription.status,
      }),
    ],
  };
};

export type ApplyStatusInput = {
  readonly status: string;
  readonly currentPeriodEnd: DateTime.Utc | null;
  readonly now: DateTime.Utc;
};

// Idempotent: replaying the same Stripe webhook delivers the same
// status — `applyStatus` always returns the post-state without
// branching on equality, so we don't second-guess Stripe. If the input
// status matches the current one the row is rewritten with a fresh
// `updatedAt`; downstream subscribers can dedupe on the
// `previousStatus === status` case.
const applyStatus = (sub: SubscriptionRoot, input: ApplyStatusInput): Result => {
  const updated = SubscriptionRoot.make({
    id: sub.id,
    organizationId: sub.organizationId,
    stripeCustomerId: sub.stripeCustomerId,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    status: input.status,
    currentPeriodEnd: input.currentPeriodEnd,
    createdAt: sub.createdAt,
    updatedAt: input.now,
  });
  return {
    subscription: updated,
    events: [
      SubscriptionStatusChanged.make({
        subscriptionId: sub.id,
        organizationId: sub.organizationId,
        status: input.status,
        previousStatus: sub.status,
      }),
    ],
  };
};

// `cancel` writes a terminal "canceled" status locally; the live
// gateway also calls Stripe to cancel the upstream subscription. We
// emit a `SubscriptionCanceled` business event in addition to the
// `SubscriptionStatusChanged` that webhook playback would emit — the
// distinction matters to consumers who care about the user-initiated
// case (e.g. "send a sorry-to-see-you-go email") vs. an automatic
// status transition.
const cancel = (sub: SubscriptionRoot, now: DateTime.Utc): Result => {
  const updated = SubscriptionRoot.make({
    id: sub.id,
    organizationId: sub.organizationId,
    stripeCustomerId: sub.stripeCustomerId,
    stripeSubscriptionId: sub.stripeSubscriptionId,
    status: "canceled",
    currentPeriodEnd: sub.currentPeriodEnd,
    createdAt: sub.createdAt,
    updatedAt: now,
  });
  return {
    subscription: updated,
    events: [
      SubscriptionCanceled.make({
        subscriptionId: sub.id,
        organizationId: sub.organizationId,
      }),
    ],
  };
};

export const SubscriptionRootOps = { create, applyStatus, cancel } as const;
