import type { LucideIcon } from "lucide-react";
import * as React from "react";
import { cn } from "../../lib/utils/cn";

export type IconSize = "sm" | "md" | "lg";
export type IconTone = "default" | "muted" | "destructive" | "inherit";

export type IconProps = {
  size?: IconSize;
  tone?: IconTone;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
  "data-testid"?: string;
};

const SIZE_CLASS: Record<IconSize, string> = {
  sm: "size-3",
  md: "size-4",
  lg: "size-5",
};

const TONE_CLASS: Record<IconTone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  destructive: "text-destructive",
  inherit: "",
};

export const createIcon = (Lucide: LucideIcon): React.FC<IconProps> => {
  const Icon: React.FC<IconProps> = ({
    "aria-hidden": ariaHidden = true,
    "aria-label": ariaLabel,
    "data-testid": testId,
    size = "md",
    tone = "inherit",
  }) => (
    <Lucide
      className={cn(SIZE_CLASS[size], TONE_CLASS[tone])}
      aria-hidden={ariaHidden}
      aria-label={ariaLabel}
      data-testid={testId}
    />
  );
  return Icon;
};
