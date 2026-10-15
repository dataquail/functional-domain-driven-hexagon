// ViewModel for the org's billing panel.
//
// We don't collapse Stripe's status vocabulary at the backend
// (BillingContract carries it verbatim) — the mapping from raw status
// to badge variant + human-readable label lives here, in a single
// table the test exercises exhaustively. Anything we don't recognize
// renders as the literal Stripe string under the secondary badge —
// no UI crash on a never-before-seen status.

import type { BillingContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Record from "effect/Record";

import { ApiAtoms } from "@/services/atom/api-atoms.shared";
import { notify } from "@/services/atom/notifications.shared";
import { ReactivityKeys } from "@/services/atom/reactivity-keys";
import {
  cancelSubscriptionAtom,
  makeStartSubscriptionPayload,
  startSubscriptionAtom,
  subscriptionQueryAtom,
} from "@/services/data-access/billing.atoms";
import { type CurrentSubscription } from "@/services/data-access/billing.atoms";
import { formatOptionalDay } from "@/services/format/date.shared";

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

export type BillingPanelView = {
  readonly hasSubscription: boolean;
  readonly statusLabel: string;
  readonly statusVariant: BadgeVariant;
  // Absent until Stripe reports a period end.
  readonly currentPeriodEndLabel?: string;
  readonly canStart: boolean;
  readonly canCancel: boolean;
};

type StatusPresentation = {
  readonly label: string;
  readonly variant: BadgeVariant;
  readonly cancelable: boolean;
};

const STATUS_PRESENTATION = {
  active: { label: "Active", variant: "default", cancelable: true },
  trialing: { label: "Trialing", variant: "default", cancelable: true },
  past_due: { label: "Past due", variant: "destructive", cancelable: true },
  unpaid: { label: "Unpaid", variant: "destructive", cancelable: true },
  incomplete: { label: "Incomplete", variant: "secondary", cancelable: true },
  incomplete_expired: { label: "Incomplete (expired)", variant: "secondary", cancelable: false },
  canceled: { label: "Canceled", variant: "outline", cancelable: false },
  paused: { label: "Paused", variant: "secondary", cancelable: true },
} satisfies Record.ReadonlyRecord<string, StatusPresentation>;

const presentStatus = (status: string) =>
  Option.getOrElse(
    Record.get<string, StatusPresentation>(STATUS_PRESENTATION, status),
    (): StatusPresentation => ({ label: status, variant: "secondary", cancelable: true }),
  );

const NO_SUBSCRIPTION_VIEW: BillingPanelView = {
  hasSubscription: false,
  statusLabel: "No subscription",
  statusVariant: "secondary",
  canStart: true,
  canCancel: false,
};

const subscriptionView = (subscription: BillingContract.SubscriptionResponse): BillingPanelView => {
  const presentation = presentStatus(subscription.status);

  const view: BillingPanelView = {
    hasSubscription: true,
    statusLabel: presentation.label,
    statusVariant: presentation.variant,
    canStart: false,
    canCancel: presentation.cancelable,
  };

  return Option.match(formatOptionalDay(Option.fromNullOr(subscription.currentPeriodEnd)), {
    onNone: () => view,
    onSome: (currentPeriodEndLabel) => ({ ...view, currentPeriodEndLabel }),
  });
};

export const computeBillingPanelView = (subscription: CurrentSubscription): BillingPanelView =>
  Option.match(subscription, { onNone: () => NO_SUBSCRIPTION_VIEW, onSome: subscriptionView });

export const subscriptionResultAtom = Atom.family((orgId: OrganizationId) =>
  Atom.make((get) => get(subscriptionQueryAtom(orgId))),
);

export const billingPanelAtom = Atom.family((orgId: OrganizationId) =>
  Atom.make((get): BillingPanelView => {
    const subscription = AsyncResult.getOrElse(get(subscriptionResultAtom(orgId)), () =>
      Option.none(),
    );

    return computeBillingPanelView(subscription);
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
