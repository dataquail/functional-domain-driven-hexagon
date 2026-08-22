"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button } from "@org/components/primitives/button";
import { Form } from "@org/components/primitives/form";
import { Input } from "@org/components/primitives/input";
import { Label } from "@org/components/primitives/label";

import { fieldsAtom, setNameAtom, submitAtom, visibleErrorsAtom } from "./create-org.view-model";

export const CreateOrg: React.FC = () => {
  const fields = useAtomValue(fieldsAtom);
  const errors = useAtomValue(visibleErrorsAtom);
  const submitState = useAtomValue(submitAtom);
  const setName = useAtomSet(setNameAtom);
  const submit = useAtomSet(submitAtom);

  const isSubmitting = submitState.waiting;

  return (
    <Form
      onSubmit={() => {
        submit();
      }}
    >
      <Form.Control>
        <Label htmlFor="create-org-name">Organization name</Label>
        <Input
          id="create-org-name"
          value={fields.name}
          onChange={(event) => {
            setName(event.target.value);
          }}
          placeholder="Acme Inc."
          data-testid="create-org-name"
        />
        <Form.Error error={errors?.name} />
      </Form.Control>

      <Button type="submit" width="full" disabled={isSubmitting} data-testid="create-org-submit">
        {isSubmitting ? "Creating…" : "Create organization"}
      </Button>
    </Form>
  );
};
