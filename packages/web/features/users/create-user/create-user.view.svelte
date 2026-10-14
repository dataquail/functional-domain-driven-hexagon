<script lang="ts">
  import Button from "@org/components/primitives/button.svelte";
  import { Form } from "@org/components/primitives/form";
  import { Grid } from "@org/components/primitives/grid";
  import Input from "@org/components/primitives/input.svelte";
  import Label from "@org/components/primitives/label.svelte";

  import { atomSet, atomValue } from "@/services/bridge/atom-bridge.svelte";

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

  const fields = atomValue(fieldsAtom);
  const errors = atomValue(visibleErrorsAtom);
  const submitState = atomValue(submitAtom);
  const setField = atomSet(setFieldAtom);
  const submit = atomSet(submitAtom);
</script>

<Form
  onSubmit={() => {
    submit();
  }}
>
  <Grid columnsAbove={2} gap="lg">
    {#each FIELDS as field (field.name)}
      <Grid.Item spanAbove={field.fullWidth === true ? 2 : 1}>
        <Form.Control>
          <Label htmlFor={field.name}>{field.label}</Label>
          <Input
            type={field.type}
            id={field.name}
            value={fields.current[field.name]}
            onValueChange={(value) => {
              setField({ field: field.name, value });
            }}
            placeholder={field.placeholder}
            data-testid={field.testId}
          />
          <Form.Error error={errors.current?.[field.name]} />
        </Form.Control>
      </Grid.Item>
    {/each}
  </Grid>

  <Button
    type="submit"
    width="full"
    disabled={submitState.current.waiting}
    data-testid="create-user-submit"
  >
    {submitState.current.waiting ? "Creating…" : "Create user"}
  </Button>
</Form>
