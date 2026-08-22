import { cn } from "../lib/utils/cn";

// A card. `Card.Title` and `Card.Description` are deliberately absent: a title
// is a `Heading` and a description is `Text`, and having two ways to render a
// heading is how a type scale drifts. The card owns its chrome; the typography
// primitives own their type.

export type CardElevation = "none" | "sm" | "md";
export type CardInteractive = "none" | "raise";
export type CardHeaderPadding = "default" | "tight";
export type CardContentGap = "none" | "sm" | "md" | "lg";

const ELEVATION: Record<CardElevation, string> = {
  none: "",
  sm: "shadow-sm",
  md: "shadow-md",
};

const INTERACTIVE: Record<CardInteractive, string> = {
  none: "",
  raise: "transition-shadow hover:shadow-md",
};

const HEADER_PADDING: Record<CardHeaderPadding, string> = {
  default: "p-6",
  tight: "px-6 pt-6 pb-2",
};

const CONTENT_GAP: Record<CardContentGap, string> = {
  none: "",
  sm: "space-y-2",
  md: "space-y-3",
  lg: "space-y-4",
};

export type CardProps = {
  readonly elevation?: CardElevation;
  /** Lift on hover — for a card that is itself a link target. */
  readonly interactive?: CardInteractive;
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const CardRoot: React.FC<CardProps> = ({
  children,
  "data-testid": testId,
  elevation = "sm",
  interactive = "none",
}) => (
  <div
    data-slot="card"
    data-testid={testId}
    className={cn(
      "rounded-xl border bg-card text-card-foreground",
      ELEVATION[elevation],
      INTERACTIVE[interactive],
    )}
  >
    {children}
  </div>
);

export type CardHeaderProps = {
  readonly padding?: CardHeaderPadding;
  readonly children?: React.ReactNode;
};

const CardHeader: React.FC<CardHeaderProps> = ({ children, padding = "default" }) => (
  <div data-slot="card-header" className={cn("flex flex-col gap-1.5", HEADER_PADDING[padding])}>
    {children}
  </div>
);

export type CardContentProps = {
  readonly gap?: CardContentGap;
  readonly children?: React.ReactNode;
};

const CardContent: React.FC<CardContentProps> = ({ children, gap = "none" }) => (
  <div data-slot="card-content" className={cn("p-6 pt-0", CONTENT_GAP[gap])}>
    {children}
  </div>
);

export type CardFooterProps = {
  readonly children?: React.ReactNode;
};

const CardFooter: React.FC<CardFooterProps> = ({ children }) => (
  <div data-slot="card-footer" className="flex items-center p-6 pt-0">
    {children}
  </div>
);

const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Content: CardContent,
  Footer: CardFooter,
});

export { Card };
