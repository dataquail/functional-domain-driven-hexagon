<script module lang="ts">
  export type SkeletonHeight = "text" | "control" | "row" | "card";

  export type SkeletonWidth = "full" | "half" | "switcher";

  export type SkeletonRadius = "sm" | "md" | "lg";

  const HEIGHT: Record<SkeletonHeight, string> = {
    text: "h-4",
    control: "h-9",
    row: "h-14",
    card: "h-20",
  };

  const WIDTH: Record<SkeletonWidth, string> = {
    full: "w-full",
    half: "w-1/2",
    // Matches the Select trigger's `md` width, which is what it stands in for.
    switcher: "w-50",
  };

  const RADIUS: Record<SkeletonRadius, string> = {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
  };

  export type SkeletonProps = {
    readonly height?: SkeletonHeight;
    readonly width?: SkeletonWidth;
    readonly radius?: SkeletonRadius;
    readonly "data-testid"?: string;
  };
</script>

<script lang="ts">
  const {
    "data-testid": testId,
    height = "text",
    radius = "md",
    width = "full",
  }: SkeletonProps = $props();
</script>

<div
  data-slot="skeleton"
  data-testid={testId}
  aria-hidden="true"
  class={["animate-pulse bg-primary/10", HEIGHT[height], WIDTH[width], RADIUS[radius]]}
></div>
