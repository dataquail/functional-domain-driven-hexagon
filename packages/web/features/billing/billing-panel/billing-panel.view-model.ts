// View-model for BillingPanel (ADR-0014 Tier 3). Pure data → data:
// translate a Stripe subscription record (or its absence) into the
// shape the panel renders.
//
// We don't collapse Stripe's status vocabulary at the backend
// (BillingContract carries it verbatim) — the mapping from raw status
// to badge variant + human-readable label lives here, in a single
// switch the test exercises exhaustively. Anything we don't recognize
// renders as the literal Stripe string under the secondary badge —
// no UI crash on a never-before-seen status.

import type { BillingContract } from "@org/contracts/api/Contracts";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export type BillingPanelView = {
  readonly hasSubscription: boolean;
  readonly statusLabel: string;
  readonly statusVariant: BadgeVariant;
  readonly currentPeriodEndLabel: string | null;
  readonly canStart: boolean;
  readonly canCancel: boolean;
};

// TanStack Query's dehydrate → JSON → hydrate round-trip turns
// `Schema.DateTimeUtc` into its toJSON() form (an ISO string) — the
// Schema decode does NOT re-run on hydration. On the client, the runtime
// shape is `string`, not `DateTime.Utc`, despite the contract type.
// Treat anything we get as string-or-date-like and slice the ISO prefix.
const formatDate = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, 10);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "epochMillis" in value) {
    const millis = value.epochMillis;
    if (typeof millis === "number" && Number.isFinite(millis)) {
      return new Date(millis).toISOString().slice(0, 10);
    }
  }
  return null;
};

export const computeBillingPanelView = (
  subscription: BillingContract.SubscriptionResponse | null,
): BillingPanelView => {
  if (subscription === null) {
    return {
      hasSubscription: false,
      statusLabel: "No subscription",
      statusVariant: "secondary",
      currentPeriodEndLabel: null,
      canStart: true,
      canCancel: false,
    };
  }

  const mapped = mapStatus(subscription.status);

  return {
    hasSubscription: true,
    statusLabel: mapped.label,
    statusVariant: mapped.variant,
    currentPeriodEndLabel: formatDate(subscription.currentPeriodEnd),
    canStart: false,
    canCancel: mapped.cancelable,
  };
};

const mapStatus = (
  status: string,
): { readonly label: string; readonly variant: BadgeVariant; readonly cancelable: boolean } => {
  switch (status) {
    case "active":
      return { label: "Active", variant: "default", cancelable: true };
    case "trialing":
      return { label: "Trialing", variant: "default", cancelable: true };
    case "past_due":
      return { label: "Past due", variant: "destructive", cancelable: true };
    case "unpaid":
      return { label: "Unpaid", variant: "destructive", cancelable: true };
    case "incomplete":
      return { label: "Incomplete", variant: "secondary", cancelable: true };
    case "incomplete_expired":
      return { label: "Incomplete (expired)", variant: "secondary", cancelable: false };
    case "canceled":
      return { label: "Canceled", variant: "outline", cancelable: false };
    case "paused":
      return { label: "Paused", variant: "secondary", cancelable: true };
    default:
      return { label: status, variant: "secondary", cancelable: true };
  }
};
