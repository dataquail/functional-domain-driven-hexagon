<script lang="ts">
  import Button from "@org/components/primitives/button.svelte";
  import { Form } from "@org/components/primitives/form";
  import { PlusIcon } from "@org/components/primitives/icon";
  import Input from "@org/components/primitives/input.svelte";
  import Spinner from "@org/components/primitives/spinner.svelte";
  import Stack from "@org/components/primitives/stack.svelte";
  import Text from "@org/components/primitives/text.svelte";
  import type { OrganizationId } from "@org/contracts/EntityIds";

  import { atomSet, atomValue } from "@/services/bridge/atom-bridge.svelte";

  import { fieldsAtom, setTitleAtom, submitAtom, visibleErrorsAtom } from "./add-todo.view-model";

  const { orgId }: { readonly orgId: OrganizationId } = $props();

  const fields = atomValue(fieldsAtom);
  const errors = atomValue(visibleErrorsAtom);
  const submitState = atomValue(submitAtom);
  const setTitle = atomSet(setTitleAtom);
  const submit = atomSet(submitAtom);
</script>

<Form
  onSubmit={() => {
    submit(orgId);
  }}
>
  <Stack direction="row" gap="sm" align="start">
    <Stack direction="column" grow shrinkBelowContent>
      <Form.Control>
        <Input
          type="text"
          id="add-todo-title"
          value={fields.current.title}
          onValueChange={(value) => {
            setTitle(value);
          }}
          placeholder="Add a new task..."
          data-testid="add-todo-input"
        />
        <Form.Error error={errors.current?.title} />
      </Form.Control>
    </Stack>

    <Button
      type="submit"
      size="icon"
      disabled={submitState.current.waiting}
      data-testid="add-todo-submit"
    >
      {#if submitState.current.waiting}
        <Spinner size="sm" tone="inherit" />
      {:else}
        <PlusIcon size="lg" />
      {/if}
      <Text as="span" srOnly>Add task</Text>
    </Button>
  </Stack>
</Form>
