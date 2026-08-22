import { cn } from "../lib/utils/cn";

// Two-dimensional layout for form rows and card decks. `columnsAbove` is the
// only responsive knob: one column on small screens, N from `sm` up, which is
// the whole of what this app's layouts ask for.

export type GridColumns = 1 | 2 | 3 | 4;
export type GridGap = "none" | "sm" | "md" | "lg";

const COLUMNS_ABOVE: Record<GridColumns, string> = {
  1: "sm:grid-cols-1",
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-3",
  4: "sm:grid-cols-4",
};

const GAP: Record<GridGap, string> = {
  none: "gap-0",
  sm: "gap-2",
  md: "gap-3",
  lg: "gap-4",
};

const SPAN: Record<GridColumns, string> = {
  1: "",
  2: "sm:col-span-2",
  3: "sm:col-span-3",
  4: "sm:col-span-4",
};

export type GridProps = {
  readonly columnsAbove?: GridColumns;
  readonly gap?: GridGap;
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const GridRoot: React.FC<GridProps> = ({
  children,
  columnsAbove = 2,
  "data-testid": testId,
  gap = "md",
}) => (
  <div
    data-slot="grid"
    data-testid={testId}
    className={cn("grid grid-cols-1", COLUMNS_ABOVE[columnsAbove], GAP[gap])}
  >
    {children}
  </div>
);

export type GridItemProps = {
  readonly spanAbove?: GridColumns;
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const GridItem: React.FC<GridItemProps> = ({ children, "data-testid": testId, spanAbove = 1 }) => (
  <div data-slot="grid-item" data-testid={testId} className={SPAN[spanAbove]}>
    {children}
  </div>
);

const Grid = Object.assign(GridRoot, { Item: GridItem });

export { Grid };
