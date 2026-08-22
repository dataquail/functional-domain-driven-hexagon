"use client";

import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Button } from "@org/components/primitives/button";
import { Form } from "@org/components/primitives/form";
import { Grid } from "@org/components/primitives/grid";
import { Input } from "@org/components/primitives/input";
import { Label } from "@org/components/primitives/label";

import {
  type CreateUserField,
  fieldsAtom,
  setFieldAtom,
  submitAtom,
  visibleErrorsAtom,
} from "./create-user.view-model";

const FIELDS: ReadonlyArray<{
  readonly name: CreateUserField;
  readonly label: string;
  readonly placeholder: string;
  readonly testId: string;
  readonly type?: "email";
  readonly fullWidth?: boolean;
}> = [
  {
    name: "email",
    label: "Email",
    placeholder: "user@example.com",
    testId: "create-user-email",
    type: "email",
    fullWidth: true,
  },
  { name: "country", label: "Country", placeholder: "USA", testId: "create-user-country" },
  {
    name: "postalCode",
    label: "Postal code",
    placeholder: "12345",
    testId: "create-user-postal-code",
  },
  {
    name: "street",
    label: "Street",
    placeholder: "123 Main St",
    testId: "create-user-street",
    fullWidth: true,
  },
];

export const CreateUser: React.FC = () => {
  const fields = useAtomValue(fieldsAtom);
  const errors = useAtomValue(visibleErrorsAtom);
  const submitState = useAtomValue(submitAtom);
  const setField = useAtomSet(setFieldAtom);
  const submit = useAtomSet(submitAtom);

  const isSubmitting = submitState.waiting;

  return (
    <Form
      onSubmit={() => {
        submit();
      }}
    >
      <Grid columnsAbove={2} gap="lg">
        {FIELDS.map((field) => (
          <Grid.Item key={field.name} spanAbove={field.fullWidth === true ? 2 : 1}>
            <Form.Control>
              <Label htmlFor={field.name}>{field.label}</Label>
              <Input
                type={field.type}
                id={field.name}
                value={fields[field.name]}
                onChange={(event) => {
                  setField({ field: field.name, value: event.target.value });
                }}
                placeholder={field.placeholder}
                data-testid={field.testId}
              />
              <Form.Error error={errors?.[field.name]} />
            </Form.Control>
          </Grid.Item>
        ))}
      </Grid>

      <Button type="submit" width="full" disabled={isSubmitting} data-testid="create-user-submit">
        {isSubmitting ? "Creating…" : "Create user"}
      </Button>
    </Form>
  );
};
