<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Surface from "./surface.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Surface",
    component: Surface,
    argTypes: {
      tone: { control: "inline-radio", options: ["none", "card", "muted", "subtle"] },
      radius: { control: "inline-radio", options: ["none", "md", "lg", "full"] },
      border: { control: "inline-radio", options: ["none", "all", "top", "bottom"] },
      padding: { control: "inline-radio", options: ["none", "sm", "md", "lg"] },
      interactive: { control: "inline-radio", options: ["none", "raise", "highlight"] },
    },
  });
</script>

<Story name="Card row" args={{ tone: "card", border: "all", radius: "md", padding: "md" }}>
  A bordered, padded region.
</Story>

<Story name="Muted" args={{ tone: "muted", radius: "lg", padding: "lg" }}>Nothing here yet.</Story>
