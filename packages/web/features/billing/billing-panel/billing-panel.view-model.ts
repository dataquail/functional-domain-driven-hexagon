// ViewModel for the org's billing panel.
//
// We don't collapse Stripe's status vocabulary at the backend
// (BillingContract carries it verbatim) — the mapping from raw status
// to badge variant + human-readable label lives here, in a single
// switch the test exercises exhaustively. Anything we don't recognize
// renders as the literal Stripe string under the secondary badge —
// no UI crash on a never-before-seen status.

import type { BillingContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { notify } from "@/services/atom/notifications.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";
import {
  cancelSubscriptionAtom,
  makeStartSubscriptionPayload,
  startSubscriptionAtom,
  subscriptionQueryAtom,
} from "@/services/data-access/billing.atoms";
import { formatDayOrNull } from "@/services/format/date.shared";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export type BillingPanelView = {
  readonly hasSubscription: boolean;
  readonly statusLabel: string;
  readonly statusVariant: BadgeVariant;
  readonly currentPeriodEndLabel: string | null;
  readonly canStart: boolean;
  readonly canCancel: boolean;
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
    currentPeriodEndLabel: formatDayOrNull(subscription.currentPeriodEnd),
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

export const subscriptionResultAtom = Atom.family((orgId: OrganizationId) =>
  Atom.make((get) => get(subscriptionQueryAtom(orgId))),
);

export const billingPanelAtom = Atom.family((orgId: OrganizationId) =>
  Atom.make((get): BillingPanelView => {
    const result = get(subscriptionResultAtom(orgId));
    return computeBillingPanelView(AsyncResult.isSuccess(result) ? result.value : null);
  }),
);

const BILLING_ERRORS = {
  BadGateway: (error: { readonly message: string }) => error.message,
  Forbidden: (error: { readonly message: string }) => error.message,
} as const;

export const startSubscriptionActionAtom = ApiAtoms.runtime.fn<OrganizationId>()((orgId, get) =>
  get
    .setResult(startSubscriptionAtom, {
      params: { orgId },
      payload: makeStartSubscriptionPayload(),
      reactivityKeys: ReactivityKeys.billing,
    })
    .pipe(
      notify(get, {
        success: () => "Subscription started!",
        errors: {
          ...BILLING_ERRORS,
          SubscriptionAlreadyExistsError: (error) => error.message,
        },
      }),
    ),
);

export const cancelSubscriptionActionAtom = ApiAtoms.runtime.fn<OrganizationId>()((orgId, get) =>
  get
    .setResult(cancelSubscriptionAtom, {
      params: { orgId },
      reactivityKeys: ReactivityKeys.billing,
    })
    .pipe(
      notify(get, {
        success: () => "Subscription canceled.",
        errors: {
          ...BILLING_ERRORS,
          SubscriptionNotFoundError: (error) => error.message,
        },
      }),
    ),
);

export const isStartingAtom = Atom.make((get): boolean => get(startSubscriptionActionAtom).waiting);
export const isCancelingAtom = Atom.make(
  (get): boolean => get(cancelSubscriptionActionAtom).waiting,
);
