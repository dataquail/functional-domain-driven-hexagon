"use client";

// Client-side device-approval hook. Pairs with the environment-agnostic
// Effect in `device-queries.ts`. Toasts on success and echoes the tagged
// error messages the approve endpoint can surface (unknown / expired code).

import { useEffectMutation } from "@/lib/tanstack-query";

import { approveDevice } from "./device-queries";

export const useApproveDeviceMutation = () =>
  useEffectMutation({
    mutationKey: ["DeviceQueries.approve"],
    mutationFn: approveDevice,
    toastifySuccess: () => "Device approved — return to your terminal.",
    toastifyErrors: {
      NotFound: (error) => error.message,
      Gone: (error) => error.message,
    },
  });
