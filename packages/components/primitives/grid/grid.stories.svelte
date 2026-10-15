<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import { Grid } from "./grid";

  const { Story } = defineMeta({
    title: "Primitives/Grid",
    component: Grid,
    argTypes: {
      columnsAbove: { control: "inline-radio", options: [1, 2, 3, 4] },
      gap: { control: "inline-radio", options: ["none", "sm", "md", "lg"] },
    },
  });
</script>

<Story name="Two columns" asChild>
  <Grid columnsAbove={2}>
    <Grid.Item>First name</Grid.Item>
    <Grid.Item>Last name</Grid.Item>
    <Grid.Item spanAbove={2}>Address, spanning both columns</Grid.Item>
  </Grid>
</Story>
