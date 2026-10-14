<script lang="ts">
  import Button from "@org/components-svelte/primitives/button.svelte";
  import { Form } from "@org/components-svelte/primitives/form";
  import Input from "@org/components-svelte/primitives/input.svelte";
  import Label from "@org/components-svelte/primitives/label.svelte";

  import { atomSet, atomValue } from "@/services/bridge/atom-bridge.svelte";

  import { fieldsAtom, setNameAtom, submitAtom, visibleErrorsAtom } from "./create-org.view-model";

  const fields = atomValue(fieldsAtom);
  const errors = atomValue(visibleErrorsAtom);
  const submitState = atomValue(submitAtom);
  const setName = atomSet(setNameAtom);
  const submit = atomSet(submitAtom);
</script>

<Form
  onSubmit={() => {
    submit();
  }}
>
  <Form.Control>
    <Label htmlFor="create-org-name">Organization name</Label>
    <Input
      id="create-org-name"
      value={fields.current.name}
      onValueChange={(value) => {
        setName(value);
      }}
      placeholder="Acme Inc."
      data-testid="create-org-name"
    />
    <Form.Error error={errors.current?.name} />
  </Form.Control>

  <Button
    type="submit"
    width="full"
    disabled={submitState.current.waiting}
    data-testid="create-org-submit"
  >
    {submitState.current.waiting ? "Creating…" : "Create organization"}
  </Button>
</Form>
