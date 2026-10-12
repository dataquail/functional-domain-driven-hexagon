<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Badge from "./badge.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Badge",
    component: Badge,
    argTypes: {
      variant: {
        control: "inline-radio",
        options: ["default", "secondary", "destructive", "outline"],
      },
    },
  });
</script>

<Story name="Default">Active</Story>

<Story name="Variants" asChild>
  <Badge>Default</Badge>
  <Badge variant="secondary">Secondary</Badge>
  <Badge variant="destructive">Destructive</Badge>
  <Badge variant="outline">Outline</Badge>
</Story>
