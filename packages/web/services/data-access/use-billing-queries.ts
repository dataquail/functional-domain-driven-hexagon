"use client";

// Client-side billing hooks. The suspense query reads `current`; the
// mutations call `start` / `cancel`. Errors from Stripe failures
// surface as `BadGateway` toasts, idempotency-shaped conflicts as
// `SubscriptionAlreadyExistsError`.

import type { OrganizationId } from "@org/contracts/EntityIds";

import { useEffectMutation, useEffectSuspenseQuery } from "@/lib/tanstack-query";

import {
  billingQueryKey,
  cancelSubscription,
  currentSubscriptionQuery,
  startSubscription,
} from "./billing-queries";

export const useCurrentSubscriptionSuspenseQuery = (orgId: OrganizationId) =>
  useEffectSuspenseQuery({
    queryKey: billingQueryKey({ orgId }),
    queryFn: () => currentSubscriptionQuery(orgId),
  });

export const useStartSubscriptionMutation = () =>
  useEffectMutation({
    mutationKey: ["BillingQueries.start"],
    mutationFn: startSubscription,
    toastifySuccess: () => "Subscription started!",
    toastifyErrors: {
      SubscriptionAlreadyExistsError: (error) => error.message,
      BadGateway: (error) => error.message,
      Forbidden: (error) => error.message,
    },
  });

export const useCancelSubscriptionMutation = () =>
  useEffectMutation({
    mutationKey: ["BillingQueries.cancel"],
    mutationFn: cancelSubscription,
    toastifySuccess: () => "Subscription canceled.",
    toastifyErrors: {
      SubscriptionNotFoundError: (error) => error.message,
      BadGateway: (error) => error.message,
      Forbidden: (error) => error.message,
    },
  });
