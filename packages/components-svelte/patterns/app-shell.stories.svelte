<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import Container from "../primitives/container.svelte";
  import Link from "../primitives/link.svelte";
  import Nav from "../primitives/nav.svelte";
  import AppShell from "./app-shell.svelte";
  import PageShell from "./page-shell.svelte";

  const { Story } = defineMeta({
    title: "Patterns/AppShell",
    component: AppShell,
  });
</script>

<Story name="With a nav bar" asChild>
  <AppShell>
    {#snippet nav()}
      <Nav orientation="block" tone="bar" aria-label="Primary">
        <Container paddingY="sm">
          <Link href="#" appearance="nav-item" tone="muted">Todos</Link>
        </Container>
      </Nav>
    {/snippet}
    <PageShell>The page body grows to fill the screen.</PageShell>
  </AppShell>
</Story>
