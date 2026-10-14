<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Input from "./input.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Input",
    component: Input,
  });
</script>

<script lang="ts">
  const field = $state({ value: "" });
</script>

<Story name="Controlled" asChild>
  <Input
    value={field.value}
    onValueChange={(next) => (field.value = next)}
    placeholder="What needs doing?"
    aria-label="Todo title"
  />
</Story>

<Story name="Invalid" args={{ value: "not-an-email", invalid: true, onValueChange: () => {} }} />

<Story name="Disabled" args={{ value: "Read only", disabled: true, onValueChange: () => {} }} />
