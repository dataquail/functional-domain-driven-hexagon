<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Select from "./select.svelte";

  const ORGANIZATIONS = [
    { value: "acme", label: "Acme" },
    { value: "globex", label: "Globex" },
    { value: "initech", label: "Initech", disabled: true },
  ];

  const { Story } = defineMeta({
    title: "Primitives/Select",
    component: Select,
    argTypes: {
      width: { control: "inline-radio", options: ["auto", "full", "sm", "md", "lg"] },
    },
  });
</script>

<script lang="ts">
  let value = $state<string | undefined>("acme");
</script>

<Story name="Controlled" asChild>
  <Select
    {value}
    onValueChange={(next) => (value = next)}
    items={ORGANIZATIONS}
    width="md"
    aria-label="Organization"
  />
</Story>

<Story
  name="Placeholder"
  args={{
    value: undefined,
    items: ORGANIZATIONS,
    placeholder: "Select an organization…",
    width: "md",
    onValueChange: () => {},
  }}
/>
