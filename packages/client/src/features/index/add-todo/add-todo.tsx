import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { makeFormOptions } from "@/lib/tanstack-query/make-form-options";
import { TodosQueries } from "@/services/data-access/todos-queries";
import { TodosContract } from "@org/domain/api/Contracts";
import { useForm } from "@tanstack/react-form";
import * as Schema from "effect/Schema";
import { PlusIcon } from "lucide-react";
import type React from "react";

export const AddTodo: React.FC = () => {
  const createTodoMutation = TodosQueries.useCreateTodoMutation();

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

  return (
    <Form onSubmit={form.handleSubmit}>
      <div className="flex items-center gap-2">
        <form.Field name="title">
          {(field) => (
            <Form.Control className="flex-1">
              <Input
                type="text"
                id={field.name}
                value={field.state.value}
                onChange={(e) => {
                  field.handleChange(e.target.value);
                }}
                placeholder="Add a new task..."
                className="h-10"
              />

              <Form.Error error={form.state.errorMap.onSubmit?.title} />
            </Form.Control>
          )}
        </form.Field>

        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting] as const}
          children={([canSubmit, isSubmitting]) => (
            <Button type="submit" disabled={!canSubmit} size="icon" className="h-10 w-10 shrink-0">
              {isSubmitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <PlusIcon className="h-5 w-5" />
              )}
              <span className="sr-only">Add task</span>
            </Button>
          )}
        />
      </div>
    </Form>
  );
};
