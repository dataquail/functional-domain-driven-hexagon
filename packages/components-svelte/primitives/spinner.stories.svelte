<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Spinner from "./spinner.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Spinner",
    component: Spinner,
    argTypes: {
      size: { control: "inline-radio", options: ["sm", "md", "lg"] },
      tone: { control: "inline-radio", options: ["default", "muted", "inherit"] },
    },
  });
</script>

<Story name="Default" />

<Story name="Sizes" asChild>
  <Spinner size="sm" />
  <Spinner size="md" />
  <Spinner size="lg" />
</Story>

<Story name="Labelled" args={{ label: "Saving the todo", tone: "default" }} />
