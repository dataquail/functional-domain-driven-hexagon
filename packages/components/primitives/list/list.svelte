<script module lang="ts">
  import type { Snippet } from "svelte";

  export type ListGap = "none" | "xs" | "sm" | "md";

  export type ListMarker = "none" | "disc";

  export type ListElement = "ul" | "ol";

  const GAP: Record<ListGap, string> = {
    none: "space-y-0",
    xs: "space-y-1",
    sm: "space-y-2",
    md: "space-y-3",
  };

  const MARKER: Record<ListMarker, string> = {
    none: "list-none",
    disc: "list-disc ps-5",
  };

  export type ListProps = {
    readonly as?: ListElement;
    readonly gap?: ListGap;
    readonly marker?: ListMarker;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const {
    as = "ul",
    children,
    "data-testid": testId,
    gap = "sm",
    marker = "none",
  }: ListProps = $props();
</script>

<svelte:element this={as} data-slot="list" data-testid={testId} class={[GAP[gap], MARKER[marker]]}>
  {@render children?.()}
</svelte:element>
