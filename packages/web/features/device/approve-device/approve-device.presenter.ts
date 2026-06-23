"use client";

// Presenter for ApproveDevice (ADR-0014 Tier 2). Schema-validates the user
// code and dispatches the approval mutation. Success is read off the
// mutation so the component can swap to a confirmation; the toast (fired by
// the hook) covers the transient feedback.

import { AuthContract } from "@org/contracts/api/Contracts";
import { useForm } from "@tanstack/react-form";
import * as Schema from "effect/Schema";

import { makeFormOptions } from "@/lib/tanstack-query/make-form-options";
import { useApproveDeviceMutation } from "@/services/data-access/use-device-queries";

export const useApproveDevicePresenter = (initialCode: string) => {
  const approveMutation = useApproveDeviceMutation();

  const form = useForm({
    ...makeFormOptions({
      schema: AuthContract.DeviceApprovalPayload,
      defaultValues: { userCode: initialCode },
      validator: "onSubmit",
    }),
    onSubmit: async ({ value }) => {
      const payload = Schema.decodeSync(AuthContract.DeviceApprovalPayload)(value);
      try {
        await approveMutation.mutateAsync({ userCode: payload.userCode });
      } catch {
        // Mutation has already surfaced the failure via toast.
      }
    },
  });

  return { form, isApproved: approveMutation.isSuccess };
};
