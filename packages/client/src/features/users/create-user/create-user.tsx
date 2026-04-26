import { Button } from "@/components/ui/button";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { makeFormOptions } from "@/lib/tanstack-query/make-form-options";
import { UsersQueries } from "@/services/data-access/users-queries";
import { UserContract } from "@org/contracts/api/Contracts";
import { useForm } from "@tanstack/react-form";
import * as Schema from "effect/Schema";
import type React from "react";

export const CreateUser: React.FC = () => {
  const createUserMutation = UsersQueries.useCreateUserMutation();

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

  return (
    <Form onSubmit={form.handleSubmit}>
      <div className="grid gap-4 sm:grid-cols-2">
        <form.Field name="email">
          {(field) => (
            <Form.Control className="sm:col-span-2">
              <Label htmlFor={field.name}>Email</Label>
              <Input
                type="email"
                id={field.name}
                value={field.state.value}
                onChange={(e) => {
                  field.handleChange(e.target.value);
                }}
                placeholder="user@example.com"
              />
              <Form.Error error={form.state.errorMap.onSubmit?.email} />
            </Form.Control>
          )}
        </form.Field>

        <form.Field name="country">
          {(field) => (
            <Form.Control>
              <Label htmlFor={field.name}>Country</Label>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => {
                  field.handleChange(e.target.value);
                }}
                placeholder="USA"
              />
              <Form.Error error={form.state.errorMap.onSubmit?.country} />
            </Form.Control>
          )}
        </form.Field>

        <form.Field name="postalCode">
          {(field) => (
            <Form.Control>
              <Label htmlFor={field.name}>Postal code</Label>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => {
                  field.handleChange(e.target.value);
                }}
                placeholder="12345"
              />
              <Form.Error error={form.state.errorMap.onSubmit?.postalCode} />
            </Form.Control>
          )}
        </form.Field>

        <form.Field name="street">
          {(field) => (
            <Form.Control className="sm:col-span-2">
              <Label htmlFor={field.name}>Street</Label>
              <Input
                id={field.name}
                value={field.state.value}
                onChange={(e) => {
                  field.handleChange(e.target.value);
                }}
                placeholder="123 Main St"
              />
              <Form.Error error={form.state.errorMap.onSubmit?.street} />
            </Form.Control>
          )}
        </form.Field>
      </div>

      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting] as const}
        children={([canSubmit, isSubmitting]) => (
          <Button type="submit" disabled={!canSubmit} className="mt-4 w-full">
            {isSubmitting ? "Creating…" : "Create user"}
          </Button>
        )}
      />
    </Form>
  );
};
