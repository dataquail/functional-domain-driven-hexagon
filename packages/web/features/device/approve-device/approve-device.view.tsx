"use client";

import { Button } from "@org/components/primitives/button";
import { Form } from "@org/components/primitives/form";
import { Input } from "@org/components/primitives/input";
import { Label } from "@org/components/primitives/label";

import { useApproveDevicePresenter } from "./approve-device.presenter";

export const ApproveDevice: React.FC<{ readonly initialCode: string }> = ({ initialCode }) => {
  const { form, isApproved } = useApproveDevicePresenter(initialCode);

  if (isApproved) {
    return (
      <p data-testid="device-approved" className="text-sm">
        Device approved — you can return to your terminal. The CLI is now signed in.
      </p>
    );
  }

  return (
    <Form onSubmit={form.handleSubmit}>
      <form.Field name="userCode">
        {(field) => (
          <Form.Control>
            <Label htmlFor={field.name}>Device code</Label>
            <Input
              id={field.name}
              value={field.state.value}
              onChange={(e) => {
                field.handleChange(e.target.value);
              }}
              placeholder="ABCD-2345"
              data-testid="device-code-input"
            />
            <Form.Error error={form.state.errorMap.onSubmit?.userCode} />
          </Form.Control>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button
            type="submit"
            disabled={!canSubmit}
            className="mt-4 w-full"
            data-testid="device-approve-submit"
          >
            {isSubmitting ? "Approving…" : "Approve device"}
          </Button>
        )}
      </form.Subscribe>
    </Form>
  );
};
