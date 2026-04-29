import { Button } from "@/components/primitives/button";
import { Form } from "@/components/primitives/form";
import { Input } from "@/components/primitives/input";
import { Label } from "@/components/primitives/label";
import type React from "react";
import { useCreateUserPresenter } from "./create-user.presenter";

export const CreateUser: React.FC = () => {
  const { form } = useCreateUserPresenter();

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
