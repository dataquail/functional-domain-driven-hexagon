import { Reveal } from "../primitives/reveal";
import { Stack } from "../primitives/stack";
import { Surface } from "../primitives/surface";

// A row of a list: something on the left, the content, and controls on the
// right. Three screens had each re-derived the same card chrome plus the same
// hover-reveal on the trailing control, which is the whole reason this exists.

export type ListRowProps = {
  readonly as?: "div" | "li";
  /** Rendered before the content -- a checkbox, an avatar, an icon. */
  readonly leading?: React.ReactNode;
  readonly children?: React.ReactNode;
  /** Rendered after the content -- the row's controls. */
  readonly trailing?: React.ReactNode;
  /** Fade `trailing` in on hover or keyboard focus instead of showing it always. */
  readonly revealTrailing?: boolean;
  readonly "data-testid"?: string;
};

const ListRow: React.FC<ListRowProps> = ({
  as = "div",
  children,
  "data-testid": testId,
  leading,
  revealTrailing = false,
  trailing,
}) => (
  <Surface
    as={as}
    tone="card"
    radius="md"
    border="all"
    padding="md"
    interactive="raise"
    hoverGroup={revealTrailing}
    data-testid={testId}
  >
    <Stack direction="row" gap="md" align="center" justify="between">
      <Stack direction="row" gap="md" align="center" grow shrinkBelowContent>
        {leading}
        <Stack direction="column" grow shrinkBelowContent>
          {children}
        </Stack>
      </Stack>
      {revealTrailing ? <Reveal>{trailing}</Reveal> : trailing}
    </Stack>
  </Surface>
);

export { ListRow };
