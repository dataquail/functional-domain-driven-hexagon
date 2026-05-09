"use client";

// Presenter for AddTodo (ADR-0014 Tier 2). Owns useForm orchestration —
// schema-validated submit, mutation dispatch, and reset on success — so
// the component is pure JSX over the returned form instance.

import { makeFormOptions } from "@/lib/tanstack-query/make-form-options";
import { useCreateTodoMutation } from "@/services/data-access/use-todos-queries";
import { TodosContract } from "@org/contracts/api/Contracts";
import { useForm } from "@tanstack/react-form";
import * as Schema from "effect/Schema";

export const useAddTodoPresenter = () => {
  const createTodoMutation = useCreateTodoMutation();

  const form = useForm({
    ...makeFormOptions({
      schema: TodosContract.CreateTodoPayload,
      defaultValues: {
        title: "",
      },
      validator: "onSubmit",
    }),
    onSubmit: async ({ formApi, value }) => {
      const payload = Schema.decodeSync(TodosContract.CreateTodoPayload)(value);
      await createTodoMutation.mutateAsync(payload);
      formApi.reset();
    },
  });

  return { form };
};
