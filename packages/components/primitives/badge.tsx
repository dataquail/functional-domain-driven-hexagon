import { cn } from "../lib/utils/cn";

// Status pill. Closed surface: a variant, a label, a test id. No `asChild`,
// because a badge that is secretly a link is a link that renders as a badge --
// compose `Link` around it instead.

export type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const BASE =
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold";

const VARIANT: Record<BadgeVariant, string> = {
  default: "border-transparent bg-primary text-primary-foreground shadow-sm",
  secondary: "border-transparent bg-secondary text-secondary-foreground",
  destructive: "border-transparent bg-destructive text-destructive-foreground shadow-sm",
  outline: "text-foreground",
};

export type BadgeProps = {
  readonly variant?: BadgeVariant;
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const Badge: React.FC<BadgeProps> = ({ children, "data-testid": testId, variant = "default" }) => (
  <span data-slot="badge" data-testid={testId} className={cn(BASE, VARIANT[variant])}>
    {children}
  </span>
);

export { Badge };
