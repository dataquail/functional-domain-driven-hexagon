<script module lang="ts">
  import type { Snippet } from "svelte";

  import type { CardHeaderPadding } from "../primitives/card";
  import type { HeadingAlign, HeadingSize } from "../primitives/heading.svelte";

  export type CardSectionProps = {
    readonly title: string;
    readonly titleSize?: HeadingSize;
    readonly titleAlign?: HeadingAlign;
    /** Rendered opposite the title — a link or button acting on the section. */
    readonly action?: Snippet;
    readonly headerPadding?: CardHeaderPadding;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  import { Card } from "../primitives/card";
  import Heading from "../primitives/heading.svelte";
  import Stack from "../primitives/stack.svelte";

  const {
    action,
    children,
    "data-testid": testId,
    headerPadding = "default",
    title,
    titleAlign = "start",
    titleSize = "xl",
  }: CardSectionProps = $props();
</script>

<Card elevation="md" data-testid={testId}>
  <Card.Header padding={headerPadding}>
    {#if action === undefined}
      <Heading level={2} size={titleSize} align={titleAlign}>{title}</Heading>
    {:else}
      <Stack direction="row" gap="md" align="center" justify="between">
        <Heading level={2} size={titleSize} align={titleAlign}>{title}</Heading>
        {@render action()}
      </Stack>
    {/if}
  </Card.Header>
  <Card.Content gap="lg">
    {@render children?.()}
  </Card.Content>
</Card>
