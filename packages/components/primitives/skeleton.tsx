import { cn } from "../lib/utils/cn";

// A loading placeholder sized from a closed set, so a fallback matches the
// height of the thing it stands in for instead of guessing at one. Naming the
// sizes after what they stand in for -- a line of text, a control, a list row --
// is what stops the scale drifting into arbitrary pixel heights.

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
  // Matches `Select.Trigger width="md"`, which is what it stands in for.
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

const Skeleton: React.FC<SkeletonProps> = ({
  "data-testid": testId,
  height = "text",
  radius = "md",
  width = "full",
}) => (
  <div
    data-slot="skeleton"
    data-testid={testId}
    aria-hidden="true"
    className={cn("animate-pulse bg-primary/10", HEIGHT[height], WIDTH[width], RADIUS[radius])}
  />
);

export { Skeleton };
