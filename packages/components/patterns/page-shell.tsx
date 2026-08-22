import { Container, type ContainerWidth } from "../primitives/container";
import { Stack } from "../primitives/stack";

// The outer shape of a page body: a centred, width-capped column with its
// sections evenly spaced. Twelve routes had each re-derived
// `mx-auto w-full max-w-3xl space-y-4 px-4`, which is exactly the kind of
// decision that drifts one step at a time until no two pages agree.

export type PageShellProps = {
  /** How wide the content column is allowed to get. */
  readonly width?: ContainerWidth;
  readonly children?: React.ReactNode;
  readonly "data-testid"?: string;
};

const PageShell: React.FC<PageShellProps> = ({ children, "data-testid": testId, width = "md" }) => (
  <Container width={width} paddingX="md" data-testid={testId}>
    <Stack direction="column" gap="lg">
      {children}
    </Stack>
  </Container>
);

export { PageShell };
