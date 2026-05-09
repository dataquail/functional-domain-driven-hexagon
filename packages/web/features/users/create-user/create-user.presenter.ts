"use client";

// Presenter for CreateUser (ADR-0014 Tier 2). Owns useForm
// orchestration — schema-validated submit, mutation dispatch, and
// reset on success — so the component is pure JSX over the returned
// form instance.

import { makeFormOptions } from "@/lib/tanstack-query/make-form-options";
import { useCreateUserMutation } from "@/services/data-access/use-users-queries";
import { UserContract } from "@org/contracts/api/Contracts";
import { useForm } from "@tanstack/react-form";
import * as Schema from "effect/Schema";

export const useCreateUserPresenter = () => {
  const createUserMutation = useCreateUserMutation();

  const form = useForm({
    ...makeFormOptions({
      schema: UserContract.CreateUserPayload,
      defaultValues: {
        email: "",
        country: "",
        street: "",
        postalCode: "",
      },
      validator: "onSubmit",
    }),
    onSubmit: async ({ formApi, value }) => {
      const payload = Schema.decodeSync(UserContract.CreateUserPayload)(value);
      await createUserMutation.mutateAsync(payload);
      formApi.reset();
    },
  });

  return { form };
};
