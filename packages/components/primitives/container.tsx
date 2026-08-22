import { cn } from "../lib/utils/cn";

// The centred, width-capped column every page and bar sits inside. Without it
// each screen re-derives `mx-auto w-full max-w-* px-4` and they drift apart by
// one step at a time.

export type ContainerWidth = "xs" | "sm" | "md" | "lg" | "full";
export type ContainerPaddingX = "none" | "md";
export type ContainerPaddingY = "none" | "xs" | "sm" | "lg";
export type ContainerElement = "div" | "section" | "main";

const WIDTH: Record<ContainerWidth, string> = {
  xs: "max-w-md",
  sm: "max-w-lg",
  md: "max-w-3xl",
  lg: "max-w-5xl",
  full: "max-w-none",
};

const PADDING_X: Record<ContainerPaddingX, string> = {
  none: "",
  md: "px-4",
};

const PADDING_Y: Record<ContainerPaddingY, string> = {
  none: "",
  xs: "py-2",
  sm: "py-3",
  lg: "py-12",
};

export type ContainerProps = {
  readonly as?: ContainerElement;
  readonly width?: ContainerWidth;
  readonly paddingX?: ContainerPaddingX;
  readonly paddingY?: ContainerPaddingY;
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const Container: React.FC<ContainerProps> = ({
  as: Element = "div",
  children,
  "data-testid": testId,
  paddingX = "md",
  paddingY = "none",
  width = "md",
}) => (
  <Element
    data-slot="container"
    data-testid={testId}
    className={cn("mx-auto w-full", WIDTH[width], PADDING_X[paddingX], PADDING_Y[paddingY])}
  >
    {children}
  </Element>
);

export { Container };
