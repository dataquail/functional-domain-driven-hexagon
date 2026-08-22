import { cn } from "../lib/utils/cn";

// A bordered/tinted/padded region. This is the primitive that absorbs the
// `rounded-* border bg-card p-3` cluster that would otherwise be pasted into
// every screen.

export type SurfaceTone = "none" | "card" | "muted" | "subtle";
export type SurfaceRadius = "none" | "md" | "lg" | "full";
export type SurfaceBorder = "none" | "all" | "top" | "bottom";
export type SurfacePadding = "none" | "sm" | "md" | "lg";
export type SurfaceInteractive = "none" | "raise" | "highlight";
export type SurfaceElement = "div" | "li" | "section" | "article" | "header" | "footer";

const TONE: Record<SurfaceTone, string> = {
  none: "",
  card: "bg-card text-card-foreground",
  muted: "bg-muted/50",
  subtle: "bg-muted/40",
};

const RADIUS: Record<SurfaceRadius, string> = {
  none: "",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
};

const BORDER: Record<SurfaceBorder, string> = {
  none: "",
  all: "border",
  top: "border-t",
  bottom: "border-b",
};

const PADDING: Record<SurfacePadding, string> = {
  none: "",
  sm: "px-3 py-1.5",
  md: "p-3",
  lg: "px-4 py-6",
};

const INTERACTIVE: Record<SurfaceInteractive, string> = {
  none: "",
  raise: "transition-all hover:shadow-sm",
  highlight: "transition-colors hover:bg-accent",
};

export type SurfaceProps = {
  readonly as?: SurfaceElement;
  readonly tone?: SurfaceTone;
  readonly radius?: SurfaceRadius;
  readonly border?: SurfaceBorder;
  readonly padding?: SurfacePadding;
  readonly interactive?: SurfaceInteractive;
  /** Make this the hover/focus group a descendant `Reveal` responds to. */
  readonly hoverGroup?: boolean;
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const Surface: React.FC<SurfaceProps> = ({
  as: Element = "div",
  border = "none",
  children,
  "data-testid": testId,
  hoverGroup = false,
  interactive = "none",
  padding = "none",
  radius = "none",
  tone = "none",
}) => (
  <Element
    data-slot="surface"
    data-testid={testId}
    className={cn(
      hoverGroup && "group",
      TONE[tone],
      RADIUS[radius],
      BORDER[border],
      PADDING[padding],
      INTERACTIVE[interactive],
    )}
  >
    {children}
  </Element>
);

export { Surface };
