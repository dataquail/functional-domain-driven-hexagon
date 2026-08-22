import * as LabelPrimitive from "@radix-ui/react-label";

import { cn } from "../lib/utils/cn";

// A label whose appearance is chosen from a closed set. `decoration` exists so
// a completed-item label can strike itself through without the screen reaching
// for a utility class.

export type LabelTone = "default" | "muted";
export type LabelDecoration = "none" | "line-through";

const TONE: Record<LabelTone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
};

const DECORATION: Record<LabelDecoration, string> = {
  none: "",
  "line-through": "line-through",
};

export type LabelProps = {
  readonly htmlFor?: string;
  readonly required?: boolean;
  readonly tone?: LabelTone;
  readonly decoration?: LabelDecoration;
  /** Clip to one line with an ellipsis. Needs an ancestor that may shrink. */
  readonly truncate?: boolean;
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const Label: React.FC<LabelProps> = ({
  children,
  "data-testid": testId,
  decoration = "none",
  htmlFor,
  required = false,
  tone = "default",
  truncate = false,
}) => (
  <LabelPrimitive.Root
    data-slot="label"
    data-testid={testId}
    htmlFor={htmlFor}
    className={cn(
      "text-sm leading-none font-medium select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
      TONE[tone],
      DECORATION[decoration],
      truncate && "block truncate",
      htmlFor !== undefined && "cursor-pointer",
    )}
  >
    {children}
    {required && <span className="ml-0.5 text-destructive">*</span>}
  </LabelPrimitive.Root>
);

export { Label };
