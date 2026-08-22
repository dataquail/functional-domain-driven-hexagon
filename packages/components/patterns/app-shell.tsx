import { Stack } from "../primitives/stack";

// The authenticated frame: a full-height column with the nav pinned above a
// growing content region.

export type AppShellProps = {
  readonly nav?: React.ReactNode;
  readonly children?: React.ReactNode;
};

const AppShell: React.FC<AppShellProps> = ({ children, nav }) => (
  <Stack as="main" direction="column" minHeight="screen">
    {nav}
    <Stack direction="column" grow paddingY="lg">
      {children}
    </Stack>
  </Stack>
);

export { AppShell };
