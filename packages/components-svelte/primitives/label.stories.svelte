<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Label from "./label.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Label",
    component: Label,
    argTypes: {
      tone: { control: "inline-radio", options: ["default", "muted"] },
      decoration: { control: "inline-radio", options: ["none", "line-through"] },
    },
  });
</script>

<Story name="Default">Email</Story>

<Story name="Required" args={{ required: true }}>Email</Story>

<Story name="Completed item" args={{ tone: "muted", decoration: "line-through" }}>Buy milk</Story>
