<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";

  import CardSection from "./card-section.svelte";
  import PageShell from "./page-shell.svelte";

  const { Story } = defineMeta({
    title: "Patterns/PageShell",
    component: PageShell,
    argTypes: {
      width: { control: "inline-radio", options: ["xs", "sm", "md", "lg", "full"] },
    },
  });
</script>

<Story name="Sections" asChild>
  <PageShell width="sm">
    <CardSection title="Profile">Name and email.</CardSection>
    <CardSection title="API tokens">No tokens yet.</CardSection>
  </PageShell>
</Story>
