<script module lang="ts">
  import type { Snippet } from "svelte";

  export type StackDirection = "row" | "column";
  export type StackGap = "none" | "xs" | "sm" | "md" | "lg" | "xl";
  export type StackAlign = "start" | "center" | "end" | "stretch" | "baseline";
  export type StackJustify = "start" | "center" | "end" | "between" | "around";
  export type StackWidth = "auto" | "full";
  export type StackElement = "div" | "section" | "header" | "footer" | "main" | "aside";
  export type StackPaddingY = "none" | "md" | "lg";
  export type StackMinHeight = "none" | "screen";

  const DIRECTION: Record<StackDirection, string> = {
    row: "flex-row",
    column: "flex-col",
  };

  // Applied at `sm:` and above, so `direction` reads as the mobile default and
  // `directionAbove` as the widened one.
  const DIRECTION_ABOVE: Record<StackDirection, string> = {
    row: "sm:flex-row",
    column: "sm:flex-col",
  };

  const GAP: Record<StackGap, string> = {
    none: "gap-0",
    xs: "gap-1",
    sm: "gap-2",
    md: "gap-3",
    lg: "gap-4",
    xl: "gap-6",
  };

  const ALIGN: Record<StackAlign, string> = {
    start: "items-start",
    center: "items-center",
    end: "items-end",
    stretch: "items-stretch",
    baseline: "items-baseline",
  };

  const JUSTIFY: Record<StackJustify, string> = {
    start: "justify-start",
    center: "justify-center",
    end: "justify-end",
    between: "justify-between",
    around: "justify-around",
  };

  const WIDTH: Record<StackWidth, string> = {
    auto: "",
    full: "w-full",
  };

  const PADDING_Y: Record<StackPaddingY, string> = {
    none: "",
    md: "py-8",
    lg: "py-12",
  };

  const MIN_HEIGHT: Record<StackMinHeight, string> = {
    none: "",
    screen: "min-h-screen",
  };

  export type StackProps = {
    readonly as?: StackElement;
    readonly direction?: StackDirection;
    readonly directionAbove?: StackDirection;
    readonly gap?: StackGap;
    readonly align?: StackAlign;
    readonly justify?: StackJustify;
    readonly wrap?: boolean;
    /** Fill the free space of a parent Stack. */
    readonly grow?: boolean;
    /** Allow the box to shrink below its content width, so children may truncate. */
    readonly shrinkBelowContent?: boolean;
    readonly width?: StackWidth;
    readonly paddingY?: StackPaddingY;
    readonly minHeight?: StackMinHeight;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const {
    align = "stretch",
    as = "div",
    children,
    "data-testid": testId,
    direction = "column",
    directionAbove,
    gap = "none",
    grow = false,
    justify = "start",
    minHeight = "none",
    paddingY = "none",
    shrinkBelowContent = false,
    width = "auto",
    wrap = false,
  }: StackProps = $props();
</script>

<svelte:element
  this={as}
  data-slot="stack"
  data-testid={testId}
  class={[
    "flex",
    DIRECTION[direction],
    directionAbove !== undefined && DIRECTION_ABOVE[directionAbove],
    GAP[gap],
    ALIGN[align],
    JUSTIFY[justify],
    WIDTH[width],
    PADDING_Y[paddingY],
    MIN_HEIGHT[minHeight],
    wrap && "flex-wrap",
    grow && "flex-1",
    shrinkBelowContent && "min-w-0",
  ]}
>
  {@render children?.()}
</svelte:element>
