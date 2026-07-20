"use client";

import { Button } from "@org/components/primitives/button";
import { Form } from "@org/components/primitives/form";
import { Input } from "@org/components/primitives/input";
import { Label } from "@org/components/primitives/label";
import type { OrganizationId } from "@org/contracts/EntityIds";

import { useInviteFormPresenter } from "./invite-form.presenter";

export const InviteForm: React.FC<{ readonly orgId: OrganizationId }> = ({ orgId }) => {
  const { form } = useInviteFormPresenter(orgId);

  return (
    <Form onSubmit={form.handleSubmit}>
      <form.Field name="email">
        {(field) => (
          <Form.Control>
            <Label htmlFor={field.name}>Invitee email</Label>
            <Input
              type="email"
              id={field.name}
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value);
              }}
              placeholder="teammate@example.com"
              data-testid="invite-email"
            />
            <Form.Error error={form.state.errorMap.onSubmit?.email} />
          </Form.Control>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button
            type="submit"
            disabled={!canSubmit}
            className="mt-4 w-full"
            data-testid="invite-submit"
          >
            {isSubmitting ? "Sending…" : "Send invitation"}
          </Button>
        )}
      </form.Subscribe>
    </Form>
  );
};
