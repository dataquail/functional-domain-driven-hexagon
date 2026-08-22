import { cn } from "../lib/utils/cn";

export type SpinnerSize = "sm" | "md" | "lg";
export type SpinnerTone = "default" | "muted" | "inherit";

const SIZE: Record<SpinnerSize, string> = {
  sm: "size-4 border-2",
  md: "size-6 border-2",
  lg: "size-8 border-[3px]",
};

const TONE: Record<SpinnerTone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  inherit: "",
};

export type SpinnerProps = {
  readonly size?: SpinnerSize;
  readonly tone?: SpinnerTone;
  /** Announced to screen readers; the spinner itself is decorative. */
  readonly label?: string;
  readonly "data-testid"?: string;
};

const Spinner: React.FC<SpinnerProps> = ({
  "data-testid": testId,
  label = "Loading",
  size = "md",
  tone = "muted",
}) => (
  <span data-slot="spinner" data-testid={testId} role="status">
    <span
      aria-hidden="true"
      className={cn(
        "inline-block animate-spin rounded-full border-current border-t-transparent",
        SIZE[size],
        TONE[tone],
      )}
    />
    <span className="sr-only">{label}</span>
  </span>
);

export { Spinner };
