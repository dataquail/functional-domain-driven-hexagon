<script module lang="ts">
  import type { Snippet } from "svelte";

  export type TextElement = "p" | "span" | "div" | "dd" | "dt" | "figcaption";
  export type TextSize = "xs" | "sm" | "base" | "lg";
  export type TextTone = "default" | "muted" | "destructive" | "inherit";
  export type TextWeight = "normal" | "medium" | "semibold";
  export type TextAlign = "start" | "center" | "end";

  const SIZE: Record<TextSize, string> = {
    xs: "text-xs",
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg",
  };

  const TONE: Record<TextTone, string> = {
    default: "text-foreground",
    muted: "text-muted-foreground",
    destructive: "text-destructive",
    inherit: "",
  };

  const WEIGHT: Record<TextWeight, string> = {
    normal: "font-normal",
    medium: "font-medium",
    semibold: "font-semibold",
  };

  const ALIGN: Record<TextAlign, string> = {
    start: "text-start",
    center: "text-center",
    end: "text-end",
  };

  export type TextProps = {
    readonly as?: TextElement;
    readonly size?: TextSize;
    readonly tone?: TextTone;
    readonly weight?: TextWeight;
    readonly align?: TextAlign;
    /** Clip to one line with an ellipsis. Needs an ancestor that may shrink. */
    readonly truncate?: boolean;
    /** Visually hidden, still announced by screen readers. */
    readonly srOnly?: boolean;
    readonly children?: Snippet;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const {
    align = "start",
    as = "p",
    children,
    "data-testid": testId,
    size = "sm",
    srOnly = false,
    tone = "default",
    truncate = false,
    weight = "normal",
  }: TextProps = $props();
</script>

<svelte:element
  this={as}
  data-slot="text"
  data-testid={testId}
  class={srOnly
    ? "sr-only"
    : [SIZE[size], TONE[tone], WEIGHT[weight], ALIGN[align], truncate && "truncate"]}
>
  {@render children?.()}
</svelte:element>
