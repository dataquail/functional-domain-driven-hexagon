<script module lang="ts">
  import type { Snippet } from "svelte";

  export type ContainerWidth = "xs" | "sm" | "md" | "lg" | "full";

  export type ContainerPaddingX = "none" | "md";

  export type ContainerPaddingY = "none" | "xs" | "sm" | "lg";

  export type ContainerElement = "div" | "section" | "main";

  const WIDTH: Record<ContainerWidth, string> = {
    xs: "max-w-md",
    sm: "max-w-lg",
    md: "max-w-3xl",
    lg: "max-w-5xl",
    full: "max-w-none",
  };

  const PADDING_X: Record<ContainerPaddingX, string> = {
    none: "",
    md: "px-4",
  };

  const PADDING_Y: Record<ContainerPaddingY, string> = {
    none: "",
    xs: "py-2",
    sm: "py-3",
    lg: "py-12",
  };

  export type ContainerProps = {
    readonly as?: ContainerElement;
    readonly width?: ContainerWidth;
    readonly paddingX?: ContainerPaddingX;
    readonly paddingY?: ContainerPaddingY;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const {
    as = "div",
    children,
    "data-testid": testId,
    paddingX = "md",
    paddingY = "none",
    width = "md",
  }: ContainerProps = $props();
</script>

<svelte:element
  this={as}
  data-slot="container"
  data-testid={testId}
  class={["mx-auto w-full", WIDTH[width], PADDING_X[paddingX], PADDING_Y[paddingY]]}
>
  {@render children?.()}
</svelte:element>
