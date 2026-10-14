<script module lang="ts">
  import type { Snippet } from "svelte";

  export type NavOrientation = "horizontal" | "vertical" | "block";

  export type NavTone = "none" | "bar";

  const ORIENTATION: Record<NavOrientation, string> = {
    horizontal: "flex flex-row items-center gap-3",
    vertical: "flex flex-col gap-2",
    // For a full-width bar that lays its own contents out with a Container.
    block: "",
  };

  const TONE: Record<NavTone, string> = {
    none: "",
    bar: "border-b bg-card",
  };

  export type NavProps = {
    readonly orientation?: NavOrientation;
    readonly tone?: NavTone;
    readonly "aria-label"?: string;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const {
    "aria-label": ariaLabel,
    children,
    "data-testid": testId,
    orientation = "horizontal",
    tone = "none",
  }: NavProps = $props();
</script>

<nav
  aria-label={ariaLabel}
  data-slot="nav"
  data-testid={testId}
  class={[ORIENTATION[orientation], TONE[tone]]}
>
  {@render children?.()}
</nav>
