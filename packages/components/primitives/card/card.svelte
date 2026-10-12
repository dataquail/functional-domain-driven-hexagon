<script module lang="ts">
  import type { Snippet } from "svelte";

  export type CardElevation = "none" | "sm" | "md";
  export type CardInteractive = "none" | "raise";

  const ELEVATION: Record<CardElevation, string> = {
    none: "",
    sm: "shadow-sm",
    md: "shadow-md",
  };

  const INTERACTIVE: Record<CardInteractive, string> = {
    none: "",
    raise: "transition-shadow hover:shadow-md",
  };

  export type CardProps = {
    readonly elevation?: CardElevation;
    /** Lift on hover — for a card that is itself a link target. */
    readonly interactive?: CardInteractive;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const {
    children,
    "data-testid": testId,
    elevation = "sm",
    interactive = "none",
  }: CardProps = $props();
</script>

<div
  data-slot="card"
  data-testid={testId}
  class={[
    "rounded-xl border bg-card text-card-foreground",
    ELEVATION[elevation],
    INTERACTIVE[interactive],
  ]}
>
  {@render children?.()}
</div>
