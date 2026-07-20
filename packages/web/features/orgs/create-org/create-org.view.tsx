"use client";

import { Button } from "@org/components/primitives/button";
import { Form } from "@org/components/primitives/form";
import { Input } from "@org/components/primitives/input";
import { Label } from "@org/components/primitives/label";

import { useCreateOrgPresenter } from "./create-org.presenter";

export const CreateOrg: React.FC = () => {
  const { form } = useCreateOrgPresenter();

  return (
    <Form onSubmit={form.handleSubmit}>
      <form.Field name="name">
        {(field) => (
          <Form.Control>
            <Label htmlFor={field.name}>Organization name</Label>
            <Input
              id={field.name}
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value);
              }}
              placeholder="Acme Inc."
              data-testid="create-org-name"
            />
            <Form.Error error={form.state.errorMap.onSubmit?.name} />
          </Form.Control>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button
            type="submit"
            disabled={!canSubmit}
            className="mt-4 w-full"
            data-testid="create-org-submit"
          >
            {isSubmitting ? "Creating…" : "Create organization"}
          </Button>
        )}
      </form.Subscribe>
    </Form>
  );
};
