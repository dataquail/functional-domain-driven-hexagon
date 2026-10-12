<script lang="ts">
  import Button from "@org/components/primitives/button.svelte";
  import { Form } from "@org/components/primitives/form";
  import Input from "@org/components/primitives/input.svelte";
  import Label from "@org/components/primitives/label.svelte";
  import Text from "@org/components/primitives/text.svelte";

  import { atomSet, atomValue } from "@/services/bridge/atom-bridge.svelte";

  import {
    fieldsAtom,
    isApprovedAtom,
    setUserCodeAtom,
    submitAtom,
    visibleErrorsAtom,
  } from "./approve-device.view-model";

  const { initialCode }: { readonly initialCode: string } = $props();

  const fields = atomValue(() => fieldsAtom(initialCode));
  const errors = atomValue(() => visibleErrorsAtom(initialCode));
  const isApproved = atomValue(isApprovedAtom);
  const submitState = atomValue(() => submitAtom(initialCode));
  const setUserCode = atomSet(() => setUserCodeAtom(initialCode));
  const submit = atomSet(() => submitAtom(initialCode));
</script>

{#if isApproved.current}
  <Text data-testid="device-approved">
    Device approved — you can return to your terminal. The CLI is now signed in.
  </Text>
{:else}
  <Form
    onSubmit={() => {
      submit();
    }}
  >
    <Form.Control>
      <Label htmlFor="device-code">Device code</Label>
      <Input
        id="device-code"
        value={fields.current.userCode}
        onValueChange={(value) => {
          setUserCode(value);
        }}
        placeholder="ABCD-2345"
        data-testid="device-code-input"
      />
      <Form.Error error={errors.current?.userCode} />
    </Form.Control>

    <Button
      type="submit"
      width="full"
      disabled={submitState.current.waiting}
      data-testid="device-approve-submit"
    >
      {submitState.current.waiting ? "Approving…" : "Approve device"}
    </Button>
  </Form>
{/if}
