import NextLink from "next/link";

import { cn } from "../lib/utils/cn";

// The one place the router is named. A feature says where it wants to go and
// how the link should read; client-side navigation is this primitive's problem.

export type LinkTone = "default" | "muted" | "primary" | "inherit";
export type LinkUnderline = "none" | "hover" | "always";
export type LinkAppearance = "text" | "nav-item" | "button";

const TONE: Record<LinkTone, string> = {
  default: "text-foreground hover:text-foreground",
  muted: "text-muted-foreground hover:text-foreground",
  primary: "text-primary",
  inherit: "",
};

const UNDERLINE: Record<LinkUnderline, string> = {
  none: "no-underline",
  hover: "underline-offset-4 hover:underline",
  always: "underline underline-offset-4",
};

const APPEARANCE: Record<LinkAppearance, string> = {
  text: "",
  "nav-item": "rounded-md px-3 py-1.5 text-sm font-medium hover:bg-accent",
  button:
    "inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm font-medium shadow-xs hover:bg-accent",
};

export type LinkProps = {
  readonly href: string;
  readonly tone?: LinkTone;
  readonly underline?: LinkUnderline;
  readonly appearance?: LinkAppearance;
  /** Stretch to fill a parent Stack cell, so the whole row is clickable. */
  readonly block?: boolean;
  readonly prefetch?: boolean;
  /** Leave the app: a full document load rather than a client-side transition.
   *  Needed for anything the BFF must see as a top-level navigation. */
  readonly external?: boolean;
  readonly children?: React.ReactNode;
  readonly "aria-label"?: string;
  readonly "data-testid"?: string;
};

const Link: React.FC<LinkProps> = ({
  appearance = "text",
  "aria-label": ariaLabel,
  block = false,
  children,
  "data-testid": testId,
  external = false,
  href,
  prefetch,
  tone = "primary",
  underline = "hover",
}) => {
  const className = cn(
    "transition-colors focus-visible:outline-1",
    TONE[tone],
    UNDERLINE[underline],
    APPEARANCE[appearance],
    block && "block",
  );

  if (external) {
    return (
      <a
        href={href}
        aria-label={ariaLabel}
        data-slot="link"
        data-testid={testId}
        className={className}
      >
        {children}
      </a>
    );
  }

  return (
    <NextLink
      href={href}
      prefetch={prefetch}
      aria-label={ariaLabel}
      data-slot="link"
      data-testid={testId}
      className={className}
    >
      {children}
    </NextLink>
  );
};

export { Link };
