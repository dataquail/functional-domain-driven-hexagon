<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Button from "./button.svelte";
  import Reveal from "./reveal.svelte";
  import Surface from "./surface.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Reveal",
    component: Reveal,
  });
</script>

<Story name="Inside a hover group" asChild>
  <Surface hoverGroup border="all" padding="md" radius="md">
    Hover this row
    <Reveal><Button size="sm" variant="ghost">Delete</Button></Reveal>
  </Surface>
</Story>
