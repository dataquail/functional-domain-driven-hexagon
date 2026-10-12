<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Container from "./container.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Container",
    component: Container,
    argTypes: {
      width: { control: "inline-radio", options: ["xs", "sm", "md", "lg", "full"] },
      paddingX: { control: "inline-radio", options: ["none", "md"] },
      paddingY: { control: "inline-radio", options: ["none", "xs", "sm", "lg"] },
    },
  });
</script>

<Story name="Default">A centred, width-capped column.</Story>

<Story name="Narrow" args={{ width: "xs", paddingY: "lg" }}>A sign-in form sits in here.</Story>
