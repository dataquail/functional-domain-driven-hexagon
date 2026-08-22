import { Stack } from "../primitives/stack";
import { Surface } from "../primitives/surface";
import { Text } from "../primitives/text";

// The "nothing here yet" block, which six screens had each re-derived from the
// same four utility classes.

export type EmptyStateProps = {
  readonly message: string;
  readonly hint?: string;
  /** A call to action, e.g. a Button that opens a create form. */
  readonly action?: React.ReactNode;
  readonly "data-testid"?: string;
};

const EmptyState: React.FC<EmptyStateProps> = ({
  action,
  "data-testid": testId,
  hint,
  message,
}) => (
  <Surface tone="muted" radius="lg" padding="lg" data-testid={testId}>
    <Stack direction="column" gap="sm" align="center">
      <Text tone="muted" align="center">
        {message}
      </Text>
      {hint !== undefined && (
        <Text tone="muted" size="xs" align="center">
          {hint}
        </Text>
      )}
      {action}
    </Stack>
  </Surface>
);

export { EmptyState };
