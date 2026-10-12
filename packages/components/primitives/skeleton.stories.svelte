<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Skeleton from "./skeleton.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Skeleton",
    component: Skeleton,
    argTypes: {
      height: { control: "inline-radio", options: ["text", "control", "row", "card"] },
      width: { control: "inline-radio", options: ["full", "half", "switcher"] },
      radius: { control: "inline-radio", options: ["sm", "md", "lg"] },
    },
  });
</script>

<Story name="Text" />

<Story name="A list loading" asChild>
  <Skeleton height="row" />
  <Skeleton height="row" />
  <Skeleton height="control" width="switcher" />
</Story>
