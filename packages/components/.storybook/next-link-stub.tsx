// Storybook renders primitives outside a Next runtime, where `next/link` has no
// router to talk to. Aliasing it to a plain anchor keeps the `Link` primitive's
// visual states reviewable in isolation; navigation itself is a Next concern
// and is covered by the acceptance suite, not by a story.
import * as React from "react";

type StubLinkProps = {
  readonly href: string;
  readonly children?: React.ReactNode;
  readonly prefetch?: boolean;
} & Omit<React.ComponentProps<"a">, "href">;

const StubLink: React.FC<StubLinkProps> = ({ children, href, prefetch: _prefetch, ...rest }) => (
  <a href={href} {...rest}>
    {children}
  </a>
);

export default StubLink;
