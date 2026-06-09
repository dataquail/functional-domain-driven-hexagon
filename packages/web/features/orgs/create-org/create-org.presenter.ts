"use client";

// Presenter for CreateOrg (ADR-0014 Tier 2). Schema-validates submit,
// dispatches the mutation, and on success navigates the user into the
// freshly-created org so they don't have to pick it back out of the
// switcher.

import { OrganizationContract } from "@org/contracts/api/Contracts";
import { useForm } from "@tanstack/react-form";
import * as Schema from "effect/Schema";
import { useRouter } from "next/navigation";

import { makeFormOptions } from "@/lib/tanstack-query/make-form-options";
import { useCreateOrganizationMutation } from "@/services/data-access/use-orgs-queries";

export const useCreateOrgPresenter = () => {
  const router = useRouter();
  const createMutation = useCreateOrganizationMutation();

  const form = useForm({
    ...makeFormOptions({
      schema: OrganizationContract.CreateOrganizationPayload,
      defaultValues: { name: "" },
      validator: "onSubmit",
    }),
    onSubmit: async ({ formApi, value }) => {
      const payload = Schema.decodeSync(OrganizationContract.CreateOrganizationPayload)(value);
      try {
        const result = await createMutation.mutateAsync(payload);
        formApi.reset();
        router.push(`/orgs/${result.id}`);
      } catch {
        // Mutation has already surfaced the failure via toast.
      }
    },
  });

  return { form };
};
