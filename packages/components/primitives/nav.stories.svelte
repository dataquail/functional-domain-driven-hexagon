<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Link from "./link.svelte";
  import Nav from "./nav.svelte";

  const { Story } = defineMeta({
    title: "Primitives/Nav",
    component: Nav,
    argTypes: {
      orientation: { control: "inline-radio", options: ["horizontal", "vertical", "block"] },
      tone: { control: "inline-radio", options: ["none", "bar"] },
    },
  });
</script>

<Story name="Horizontal bar" asChild>
  <Nav tone="bar" aria-label="Primary">
    <Link href="#" appearance="nav-item" tone="muted">Todos</Link>
    <Link href="#" appearance="nav-item" tone="muted">Organizations</Link>
  </Nav>
</Story>

<Story name="Vertical" asChild>
  <Nav orientation="vertical" aria-label="Settings">
    <Link href="#">Profile</Link>
    <Link href="#">API tokens</Link>
  </Nav>
</Story>
