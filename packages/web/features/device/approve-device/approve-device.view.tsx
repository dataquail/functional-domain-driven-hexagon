"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button } from "@org/components/primitives/button";
import { Form } from "@org/components/primitives/form";
import { Input } from "@org/components/primitives/input";
import { Label } from "@org/components/primitives/label";
import { Text } from "@org/components/primitives/text";

import {
  fieldsAtom,
  isApprovedAtom,
  setUserCodeAtom,
  submitAtom,
  visibleErrorsAtom,
} from "./approve-device.view-model";

export const ApproveDevice: React.FC<{ readonly initialCode: string }> = ({ initialCode }) => {
  const fields = useAtomValue(fieldsAtom(initialCode));
  const errors = useAtomValue(visibleErrorsAtom(initialCode));
  const isApproved = useAtomValue(isApprovedAtom);
  const submitState = useAtomValue(submitAtom(initialCode));
  const setUserCode = useAtomSet(setUserCodeAtom(initialCode));
  const submit = useAtomSet(submitAtom(initialCode));

  const isSubmitting = submitState.waiting;

  if (isApproved) {
    return (
      <Text data-testid="device-approved">
        Device approved — you can return to your terminal. The CLI is now signed in.
      </Text>
    );
  }

  return (
    <Form
      onSubmit={() => {
        submit();
      }}
    >
      <Form.Control>
        <Label htmlFor="device-code">Device code</Label>
        <Input
          id="device-code"
          value={fields.userCode}
          onChange={(event) => {
            setUserCode(event.target.value);
          }}
          placeholder="ABCD-2345"
          data-testid="device-code-input"
        />
        <Form.Error error={errors?.userCode} />
      </Form.Control>

      <Button
        type="submit"
        width="full"
        disabled={isSubmitting}
        data-testid="device-approve-submit"
      >
        {isSubmitting ? "Approving…" : "Approve device"}
      </Button>
    </Form>
  );
};
