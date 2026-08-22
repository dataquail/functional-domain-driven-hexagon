import { cn } from "../lib/utils/cn";

// Semantic lists. `List.Item` is deliberately layout-free -- wrap its content
// in a Stack or Surface for anything richer than a line of text, so row
// chrome stays composed rather than baked into the list.

export type ListGap = "none" | "xs" | "sm" | "md";
export type ListMarker = "none" | "disc";

const GAP: Record<ListGap, string> = {
  none: "space-y-0",
  xs: "space-y-1",
  sm: "space-y-2",
  md: "space-y-3",
};

const MARKER: Record<ListMarker, string> = {
  none: "list-none",
  disc: "list-disc ps-5",
};

export type ListProps = {
  readonly as?: "ul" | "ol";
  readonly gap?: ListGap;
  readonly marker?: ListMarker;
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const ListRoot: React.FC<ListProps> = ({
  as: Element = "ul",
  children,
  "data-testid": testId,
  gap = "sm",
  marker = "none",
}) => (
  <Element data-slot="list" data-testid={testId} className={cn(GAP[gap], MARKER[marker])}>
    {children}
  </Element>
);

export type ListItemProps = {
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const ListItem: React.FC<ListItemProps> = ({ children, "data-testid": testId }) => (
  <li data-slot="list-item" data-testid={testId}>
    {children}
  </li>
);

const List = Object.assign(ListRoot, { Item: ListItem });

export { List };
