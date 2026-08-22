import { cn } from "../lib/utils/cn";

// Content that fades in when its surrounding group is hovered or focused.
//
// The paired half is `Surface hoverGroup` -- Tailwind's `group-hover:` only
// resolves against an ancestor carrying `group`, so a Reveal with no such
// ancestor stays hidden to the mouse and visible only to the keyboard.
//
// It never unmounts: a control that disappears from the accessibility tree on
// blur is a control a screen reader cannot reach.

export type RevealProps = {
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const Reveal: React.FC<RevealProps> = ({ children, "data-testid": testId }) => (
  <span
    data-slot="reveal"
    data-testid={testId}
    className={cn(
      "opacity-0 transition-opacity",
      "group-focus-within:opacity-100 group-hover:opacity-100 focus-within:opacity-100",
    )}
  >
    {children}
  </span>
);

export { Reveal };
