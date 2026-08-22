import { cn } from "../lib/utils/cn";

export type HeadingLevel = 1 | 2 | 3 | 4;
export type HeadingSize = "sm" | "md" | "lg" | "xl";
export type HeadingTone = "default" | "muted";
export type HeadingAlign = "start" | "center";

const SIZE: Record<HeadingSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl",
  xl: "text-2xl",
};

const TONE: Record<HeadingTone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
};

const ALIGN: Record<HeadingAlign, string> = {
  start: "text-start",
  center: "text-center",
};

export type HeadingProps = {
  /** Document outline position. Independent of `size`, so a visually small
   *  heading can still be an `h1` where the outline calls for one. */
  readonly level?: HeadingLevel;
  readonly size?: HeadingSize;
  readonly tone?: HeadingTone;
  readonly align?: HeadingAlign;
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const Heading: React.FC<HeadingProps> = ({
  align = "start",
  children,
  "data-testid": testId,
  level = 2,
  size = "lg",
  tone = "default",
}) => {
  const Element = `h${level}` as const;
  return (
    <Element
      data-slot="heading"
      data-testid={testId}
      className={cn(
        SIZE[size],
        TONE[tone],
        ALIGN[align],
        "leading-none font-semibold tracking-tight",
      )}
    >
      {children}
    </Element>
  );
};

export { Heading };
