<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import { List } from "./index";

  const { Story } = defineMeta({
    title: "Primitives/List",
    component: List,
    argTypes: {
      gap: { control: "inline-radio", options: ["none", "xs", "sm", "md"] },
      marker: { control: "inline-radio", options: ["none", "disc"] },
    },
  });
</script>

<Story name="Bulleted" asChild>
  <List marker="disc">
    <List.Item>First</List.Item>
    <List.Item>Second</List.Item>
    <List.Item>Third</List.Item>
  </List>
</Story>

<Story name="Ordered" asChild>
  <List as="ol" gap="xs">
    <List.Item>Create an organization</List.Item>
    <List.Item>Invite a teammate</List.Item>
  </List>
</Story>
