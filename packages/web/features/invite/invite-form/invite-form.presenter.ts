"use client";

// Presenter for InviteForm. Validates an email, dispatches the
// inviteUser mutation against the given org, and resets on success.
// The 403 from a non-admin caller surfaces as a toast via the
// mutation hook's `Forbidden` mapping.

import { OrganizationContract } from "@org/contracts/api/Contracts";
import type { OrganizationId } from "@org/contracts/EntityIds";
import { useForm } from "@tanstack/react-form";
import * as Schema from "effect/Schema";

import { makeFormOptions } from "@/lib/tanstack-query/make-form-options";
import { useInviteUserMutation } from "@/services/data-access/use-orgs-queries";

export const useInviteFormPresenter = (orgId: OrganizationId) => {
  const inviteMutation = useInviteUserMutation();

  const form = useForm({
    ...makeFormOptions({
      schema: OrganizationContract.InviteUserPayload,
      defaultValues: { email: "" },
      validator: "onSubmit",
    }),
    onSubmit: async ({ formApi, value }) => {
      const payload = Schema.decodeSync(OrganizationContract.InviteUserPayload)(value);
      try {
        await inviteMutation.mutateAsync({ orgId, payload });
        formApi.reset();
      } catch {
        // Mutation has already surfaced the failure via toast.
      }
    },
  });

  return { form };
};
