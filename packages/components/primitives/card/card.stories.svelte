<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import { Card } from "./card.ts";

  const { Story } = defineMeta({
    title: "Primitives/Card",
    component: Card,
    argTypes: {
      elevation: { control: "inline-radio", options: ["none", "sm", "md"] },
      interactive: { control: "inline-radio", options: ["none", "raise"] },
    },
  });
</script>

<Story name="Default" asChild>
  <Card>
    <Card.Header>Header</Card.Header>
    <Card.Content gap="md">
      <span>First line of content</span>
      <span>Second line of content</span>
    </Card.Content>
    <Card.Footer>Footer</Card.Footer>
  </Card>
</Story>

<Story name="Tight header, raised on hover" asChild>
  <Card elevation="md" interactive="raise">
    <Card.Header padding="tight">A card that is a link target</Card.Header>
    <Card.Content>Hover me.</Card.Content>
  </Card>
</Story>
