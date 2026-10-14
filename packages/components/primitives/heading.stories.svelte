<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Heading from "./heading.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Heading",
    component: Heading,
    argTypes: {
      level: { control: "inline-radio", options: [1, 2, 3, 4] },
      size: { control: "inline-radio", options: ["sm", "md", "lg", "xl"] },
      tone: { control: "inline-radio", options: ["default", "muted"] },
      align: { control: "inline-radio", options: ["start", "center"] },
    },
  });
</script>

<Story name="Default">Organizations</Story>

<Story name="Sizes" asChild>
  <Heading size="xl">Extra large</Heading>
  <Heading size="lg">Large</Heading>
  <Heading size="md">Medium</Heading>
  <Heading size="sm" tone="muted">Small and muted</Heading>
</Story>
