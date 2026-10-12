<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Input from "./input.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Input",
    component: Input,
  });
</script>

<script lang="ts">
  let value = $state("");
</script>

<Story name="Controlled" asChild>
  <Input
    {value}
    onValueChange={(next) => (value = next)}
    placeholder="What needs doing?"
    aria-label="Todo title"
  />
</Story>

<Story name="Invalid" args={{ value: "not-an-email", invalid: true, onValueChange: () => {} }} />

<Story name="Disabled" args={{ value: "Read only", disabled: true, onValueChange: () => {} }} />
