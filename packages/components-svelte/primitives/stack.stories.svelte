<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Stack from "./stack.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Stack",
    component: Stack,
    argTypes: {
      direction: { control: "inline-radio", options: ["row", "column"] },
      gap: { control: "inline-radio", options: ["none", "xs", "sm", "md", "lg", "xl"] },
      align: {
        control: "inline-radio",
        options: ["start", "center", "end", "stretch", "baseline"],
      },
      justify: {
        control: "inline-radio",
        options: ["start", "center", "end", "between", "around"],
      },
    },
  });
</script>

<Story name="Row, spaced between" asChild>
  <Stack direction="row" gap="md" justify="between" align="center">
    <span>Left</span>
    <span>Right</span>
  </Stack>
</Story>

<Story name="Column that becomes a row" asChild>
  <Stack direction="column" directionAbove="row" gap="sm" wrap>
    <span>One</span>
    <span>Two</span>
    <span>Three</span>
  </Stack>
</Story>
