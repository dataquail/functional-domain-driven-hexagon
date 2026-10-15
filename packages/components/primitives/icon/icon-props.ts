export type IconSize = "sm" | "md" | "lg";

export type IconTone = "default" | "muted" | "destructive" | "inherit";

export type IconProps = {
  readonly size?: IconSize;
  readonly tone?: IconTone;
  readonly "aria-label"?: string;
  readonly "aria-hidden"?: boolean;
  readonly "data-testid"?: string;
};
