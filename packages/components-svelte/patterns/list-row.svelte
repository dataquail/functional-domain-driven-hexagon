<script module lang="ts">
  import type { Snippet } from "svelte";

  export type ListRowElement = "div" | "li";

  export type ListRowProps = {
    readonly as?: ListRowElement;
    /** Rendered before the content — a checkbox, an avatar, an icon. */
    readonly leading?: Snippet;
    readonly children?: Snippet;
    /** Rendered after the content — the row's controls. */
    readonly trailing?: Snippet;
    /** Fade `trailing` in on hover or keyboard focus instead of showing it always. */
    readonly revealTrailing?: boolean;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  import Reveal from "../primitives/reveal.svelte";
  import Stack from "../primitives/stack.svelte";
  import Surface from "../primitives/surface.svelte";

  const {
    as = "div",
    children,
    "data-testid": testId,
    leading,
    revealTrailing = false,
    trailing,
  }: ListRowProps = $props();
</script>

<Surface
  {as}
  tone="card"
  radius="md"
  border="all"
  padding="md"
  interactive="raise"
  hoverGroup={revealTrailing}
  data-testid={testId}
>
  <Stack direction="row" gap="md" align="center" justify="between">
    <Stack direction="row" gap="md" align="center" grow shrinkBelowContent>
      {@render leading?.()}
      <Stack direction="column" grow shrinkBelowContent>
        {@render children?.()}
      </Stack>
    </Stack>
    {#if revealTrailing}
      <Reveal>{@render trailing?.()}</Reveal>
    {:else}
      {@render trailing?.()}
    {/if}
  </Stack>
</Surface>
