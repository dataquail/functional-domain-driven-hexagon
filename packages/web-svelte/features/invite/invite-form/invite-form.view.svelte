<script lang="ts">
  import Button from "@org/components-svelte/primitives/button.svelte";
  import { Form } from "@org/components-svelte/primitives/form";
  import Input from "@org/components-svelte/primitives/input.svelte";
  import Label from "@org/components-svelte/primitives/label.svelte";
  import type { OrganizationId } from "@org/contracts/EntityIds";

  import { atomSet, atomValue } from "@/services/bridge/atom-bridge.svelte";

  import {
    fieldsAtom,
    setEmailAtom,
    submitAtom,
    visibleErrorsAtom,
  } from "./invite-form.view-model";

  const { orgId }: { readonly orgId: OrganizationId } = $props();

  const fields = atomValue(fieldsAtom);
  const errors = atomValue(visibleErrorsAtom);
  const submitState = atomValue(submitAtom);
  const setEmail = atomSet(setEmailAtom);
  const submit = atomSet(submitAtom);
</script>

<Form
  onSubmit={() => {
    submit(orgId);
  }}
>
  <Form.Control>
    <Label htmlFor="invite-email">Invitee email</Label>
    <Input
      type="email"
      id="invite-email"
      value={fields.current.email}
      onValueChange={(value) => {
        setEmail(value);
      }}
      placeholder="teammate@example.com"
      data-testid="invite-email"
    />
    <Form.Error error={errors.current?.email} />
  </Form.Control>

  <Button
    type="submit"
    width="full"
    disabled={submitState.current.waiting}
    data-testid="invite-submit"
  >
    {submitState.current.waiting ? "Sending…" : "Send invitation"}
  </Button>
</Form>
